import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

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

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d'
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET ?? ''

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

async function authPluginFn(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies['packman_token']
    if (!token) return

    try {
      const payload = verifyToken(token)
      request.userId = payload.userId
      request.userRole = payload.role
    } catch {
      // invalid token — clear it
      reply.clearCookie('packman_token')
    }
  })
}

export const authPlugin = fp(authPluginFn)

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) {
    reply.status(401).send({ message: 'Unauthorized' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) {
    reply.status(401).send({ message: 'Unauthorized' })
    return
  }
  if (request.userRole !== 'ADMIN') {
    reply.status(403).send({ message: 'Forbidden' })
  }
}

export async function requireAuthOrAdminSecret(request: FastifyRequest, reply: FastifyReply) {
  if (ADMIN_API_SECRET && request.headers['x-admin-auth'] === ADMIN_API_SECRET) return
  if (!request.userId) {
    reply.status(401).send({ message: 'Unauthorized' })
  }
}

export async function setAuthCookie(reply: FastifyReply, userId: string, role: string) {
  const token = signToken({ userId, role })
  reply.setCookie('packman_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}
