import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'
import { getJwtExpiresIn, getJwtSecret } from '../services/runtime-config'

export interface JwtPayload {
  userId: string
  role: string
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    userRole?: string
  }
}

export function signToken(payload: JwtPayload, expiresIn?: string): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: expiresIn ?? getJwtExpiresIn() } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload
}

async function authPluginFn(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies['packman_token']
    if (!token) return

    try {
      const payload = verifyToken(token)
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true },
      })
      if (!user) {
        reply.clearCookie('packman_token')
        return
      }
      request.userId = user.id
      request.userRole = user.role
    } catch {
      // invalid token — clear it
      reply.clearCookie('packman_token')
    }
  })
}

export const authPlugin = fp(authPluginFn)

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) {
    return reply.status(401).send({ message: 'Unauthorized' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) {
    return reply.status(401).send({ message: 'Unauthorized' })
  }
  if (request.userRole !== 'ADMIN') {
    return reply.status(403).send({ message: 'Forbidden' })
  }
}

function hasAdminPanelCookie(request: FastifyRequest): boolean {
  const token = request.cookies['packman_admin_token']
  if (!token) return false
  try {
    const payload = verifyToken(token)
    return payload.role === 'ADMIN_PANEL'
  } catch {
    return false
  }
}

export async function requireAuthOrAdminSecret(request: FastifyRequest, reply: FastifyReply) {
  if (hasAdminPanelCookie(request)) return
  if (!request.userId) {
    return reply.status(401).send({ message: 'Unauthorized' })
  }
}

export async function requireAdminOrAdminSecret(request: FastifyRequest, reply: FastifyReply) {
  if (hasAdminPanelCookie(request)) return
  await requireAdmin(request, reply)
}

function cookieSecure(): boolean {
  // Off by default — most deployments are LAN over plain HTTP. Opt in to
  // Secure cookies only when you actually have TLS (e.g. behind a reverse
  // proxy with HTTPS) by setting COOKIE_SECURE=true.
  return process.env.COOKIE_SECURE === 'true'
}

export async function setAuthCookie(reply: FastifyReply, userId: string, role: string) {
  const token = signToken({ userId, role })
  reply.setCookie('packman_token', token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export { cookieSecure }
