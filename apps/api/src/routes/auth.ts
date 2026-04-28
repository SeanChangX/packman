import { FastifyInstance } from 'fastify'
import axios from 'axios'
import { prisma } from '../plugins/prisma'
import { requireAuth, setAuthCookie, signToken, verifyToken } from '../plugins/auth'
import { AdminAccountSchema } from '@packman/shared'
import {
  createInitialAdminAccount,
  getAdminAuthStatus,
  getAppConfig,
  getSlackConfig,
  verifyAdminLogin,
} from '../services/runtime-config'

const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000
const ADMIN_LOGIN_MAX_FAILURES = 5
const adminLoginFailures = new Map<string, { count: number; resetAt: number }>()

function adminLoginKey(request: { ip: string }, username: string) {
  return `${request.ip}:${username.trim().toLowerCase()}`
}

function isAdminLoginLimited(key: string) {
  const entry = adminLoginFailures.get(key)
  if (!entry) return false
  if (Date.now() > entry.resetAt) {
    adminLoginFailures.delete(key)
    return false
  }
  return entry.count >= ADMIN_LOGIN_MAX_FAILURES
}

function recordAdminLoginFailure(key: string) {
  const now = Date.now()
  const entry = adminLoginFailures.get(key)
  if (!entry || now > entry.resetAt) {
    adminLoginFailures.set(key, { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS })
    return
  }
  adminLoginFailures.set(key, { ...entry, count: entry.count + 1 })
}

export async function authRoutes(app: FastifyInstance) {
  // Initiate Slack OAuth
  app.get('/slack', async (request, reply) => {
    const [{ appUrl }, slack] = await Promise.all([getAppConfig(), getSlackConfig()])
    if (!slack.clientId || !slack.clientSecret || !slack.redirectUri) {
      return reply.redirect(`${appUrl}/login?error=slack_not_configured`)
    }

    const params = new URLSearchParams({
      client_id: slack.clientId,
      user_scope: 'identity.basic,identity.email,identity.avatar',
      redirect_uri: slack.redirectUri,
    })
    reply.redirect(`https://slack.com/oauth/v2/authorize?${params}`)
  })

  // Slack OAuth callback
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/slack/callback',
    async (request, reply) => {
      const { code, error } = request.query
      const [{ appUrl }, slack] = await Promise.all([getAppConfig(), getSlackConfig()])

      if (error || !code) {
        return reply.redirect(`${appUrl}/login?error=slack_denied`)
      }

      if (!slack.clientId || !slack.clientSecret || !slack.redirectUri) {
        return reply.redirect(`${appUrl}/login?error=slack_not_configured`)
      }

      try {
        // Exchange code for token
        const tokenRes = await axios.post<{
          ok: boolean
          authed_user?: { id: string; access_token?: string }
          team?: { id: string }
          error?: string
        }>(
          'https://slack.com/api/oauth.v2.access',
          new URLSearchParams({
            code,
            client_id: slack.clientId,
            client_secret: slack.clientSecret,
            redirect_uri: slack.redirectUri,
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        )

        if (!tokenRes.data.ok) {
          throw new Error(tokenRes.data.error ?? 'Slack OAuth failed')
        }

        const accessToken = tokenRes.data.authed_user?.access_token
        if (!accessToken) throw new Error('No user access token from Slack')

        // Restrict to specific workspace
        if (slack.workspaceId && tokenRes.data.team?.id !== slack.workspaceId) {
          return reply.redirect(`${appUrl}/login?error=wrong_workspace`)
        }

        const userToken = tokenRes.data.authed_user?.id
        if (!userToken) throw new Error('No user ID from Slack')

        // Get user identity using user token
        const identityRes = await axios.get<{
          ok: boolean
          user?: { id: string; name: string; email: string; image_192?: string }
          team?: { id: string }
        }>('https://slack.com/api/users.identity', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!identityRes.data.ok || !identityRes.data.user) {
          throw new Error('Failed to get Slack user identity')
        }

        const slackUser = identityRes.data.user

        // Upsert user in DB
        const user = await prisma.user.upsert({
          where: { slackId: slackUser.id },
          update: {
            name: slackUser.name,
            email: slackUser.email,
            avatarUrl: slackUser.image_192,
          },
          create: {
            slackId: slackUser.id,
            name: slackUser.name,
            email: slackUser.email,
            avatarUrl: slackUser.image_192,
          },
        })

        await setAuthCookie(reply, user.id, user.role)
        reply.redirect(appUrl)
      } catch (err) {
        app.log.error(err)
        reply.redirect(`${appUrl}/login?error=auth_failed`)
      }
    }
  )

  app.get('/admin-status', async () => {
    const status = await getAdminAuthStatus()
    return { setupRequired: status.setupRequired, username: status.setupRequired ? status.username : '' }
  })

  app.post<{ Body: { username: string; password: string } }>(
    '/admin-setup',
    async (request, reply) => {
      const { username, password } = AdminAccountSchema.parse(request.body)
      await createInitialAdminAccount(username, password)
      return reply.status(201).send(await getAdminAuthStatus())
    }
  )

  // Admin panel login
  app.post<{ Body: { username: string; password: string } }>(
    '/admin-login',
    async (request, reply) => {
      const { username, password } = request.body
      const key = adminLoginKey(request, username)
      if (isAdminLoginLimited(key)) {
        return reply.status(429).send({ message: '登入失敗次數過多，請稍後再試' })
      }
      if (!await verifyAdminLogin(username, password)) {
        recordAdminLoginFailure(key)
        return reply.status(401).send({ message: '帳號或密碼錯誤' })
      }
      adminLoginFailures.delete(key)
      const token = signToken({ userId: '__admin__', role: 'ADMIN_PANEL' }, '1d')
      reply.setCookie('packman_admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      })
      return { ok: true }
    }
  )

  // Admin panel logout
  app.post('/admin-logout', async (request, reply) => {
    reply.clearCookie('packman_admin_token', { path: '/' })
    return { ok: true }
  })

  // Check admin session
  app.get('/admin-me', async (request, reply) => {
    const token = request.cookies['packman_admin_token']
    if (!token) return reply.status(401).send({ message: 'Not authenticated' })
    try {
      const payload = verifyToken(token)
      if (payload.role !== 'ADMIN_PANEL') throw new Error()
      return { ok: true }
    } catch {
      reply.clearCookie('packman_admin_token', { path: '/' })
      return reply.status(401).send({ message: 'Invalid session' })
    }
  })

  // Get current user
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      include: { group: true },
    })
    if (!user) return reply.status(404).send({ message: 'User not found' })
    return user
  })

  // Logout
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('packman_token', { path: '/' })
    return { ok: true }
  })
}
