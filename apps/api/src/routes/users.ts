import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth, requireAuthOrAdminSecret } from '../plugins/auth'
import { UpdateUserSchema } from '@packman/shared'
import { getActiveEventId } from '../services/events'

const userSelect = {
  id: true,
  slackId: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  groupId: true,
  group: true,
  createdAt: true,
}

export async function userRoutes(app: FastifyInstance) {
  // GET /users feeds owner pickers across the web SPA. When the active event
  // has at least one EventMember row, we restrict the result to those members
  // so users can find owners faster. Empty membership = unrestricted.
  app.get('/', { preHandler: requireAuthOrAdminSecret }, async () => {
    const activeEventId = await getActiveEventId().catch(() => null)
    if (activeEventId) {
      const memberCount = await prisma.eventMember.count({ where: { eventId: activeEventId } })
      if (memberCount > 0) {
        return prisma.user.findMany({
          where: { eventMembers: { some: { eventId: activeEventId } } },
          select: userSelect,
          orderBy: { name: 'asc' },
        })
      }
    }
    return prisma.user.findMany({
      select: userSelect,
      orderBy: { name: 'asc' },
    })
  })

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.params.id },
        select: userSelect,
      })
      if (!user) return reply.status(404).send({ message: 'User not found' })
      return user
    }
  )

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      // Users can only update themselves unless admin
      if (request.params.id !== request.userId && request.userRole !== 'ADMIN') {
        return reply.status(403).send({ message: 'Forbidden' })
      }
      const body = UpdateUserSchema.parse(request.body)
      try {
        const user = await prisma.user.update({
          where: { id: request.params.id },
          data: body,
          select: userSelect,
        })
        return user
      } catch {
        reply.status(404).send({ message: 'User not found' })
      }
    }
  )
}
