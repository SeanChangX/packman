import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth, requireAuthOrAdminSecret } from '../plugins/auth'
import { UpdateUserSchema } from '@packman/shared'

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
  app.get('/', { preHandler: requireAuthOrAdminSecret }, async () => {
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
