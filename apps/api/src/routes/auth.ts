import { FastifyInstance } from 'fastify'
import axios from 'axios'
import { prisma } from '../plugins/prisma'
import { requireAuth, setAuthCookie, signToken, verifyToken } from '../plugins/auth'

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID ?? ''
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET ?? ''
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI ?? ''
const SLACK_WORKSPACE_ID = process.env.SLACK_WORKSPACE_ID ?? ''
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const ADMIN_USER = process.env.ADMIN_USER ?? 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme'

export async function authRoutes(app: FastifyInstance) {
  // Initiate Slack OAuth
  app.get('/slack', async (request, reply) => {
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      user_scope: 'identity.basic,identity.email,identity.avatar',
      redirect_uri: SLACK_REDIRECT_URI,
    })
    reply.redirect(`https://slack.com/oauth/v2/authorize?${params}`)
  })

  // Slack OAuth callback
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/slack/callback',
    async (request, reply) => {
      const { code, error } = request.query

      if (error || !code) {
        return reply.redirect(`${APP_URL}/login?error=slack_denied`)
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
            client_id: SLACK_CLIENT_ID,
            client_secret: SLACK_CLIENT_SECRET,
            redirect_uri: SLACK_REDIRECT_URI,
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        )

        if (!tokenRes.data.ok) {
          throw new Error(tokenRes.data.error ?? 'Slack OAuth failed')
        }

        const accessToken = tokenRes.data.authed_user?.access_token
        if (!accessToken) throw new Error('No user access token from Slack')

        // Restrict to specific workspace
        if (SLACK_WORKSPACE_ID && tokenRes.data.team?.id !== SLACK_WORKSPACE_ID) {
          return reply.redirect(`${APP_URL}/login?error=wrong_workspace`)
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
        reply.redirect(APP_URL)
      } catch (err) {
        app.log.error(err)
        reply.redirect(`${APP_URL}/login?error=auth_failed`)
      }
    }
  )

  // Admin panel login
  app.post<{ Body: { username: string; password: string } }>(
    '/admin-login',
    async (request, reply) => {
      const { username, password } = request.body
      if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        return reply.status(401).send({ message: '帳號或密碼錯誤' })
      }
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
