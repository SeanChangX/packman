import { FastifyInstance } from 'fastify'
import axios from 'axios'
import { prisma } from '../plugins/prisma'
import { requireAuth, setAuthCookie } from '../plugins/auth'

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID ?? ''
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET ?? ''
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI ?? ''
const SLACK_WORKSPACE_ID = process.env.SLACK_WORKSPACE_ID ?? ''
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function authRoutes(app: FastifyInstance) {
  // Initiate Slack OAuth
  app.get('/slack', async (request, reply) => {
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: 'identity.basic,identity.email,identity.avatar',
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
          access_token?: string
          authed_user?: { id: string }
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
          headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
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
