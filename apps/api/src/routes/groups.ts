import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret, requireAuthOrAdminSecret } from '../plugins/auth'
import { CreateGroupSchema, UpdateGroupSchema } from '@packman/shared'

export async function groupRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuthOrAdminSecret }, async () => {
    return prisma.group.findMany({ orderBy: { name: 'asc' } })
  })

  app.post('/', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const body = CreateGroupSchema.parse(request.body)
    const group = await prisma.group.create({ data: body })
    return reply.status(201).send(group)
  })

  app.patch<{ Params: { id: string } }>(
    '/:id',
      { preHandler: requireAdminOrAdminSecret },
    async (request, reply) => {
      const body = UpdateGroupSchema.parse(request.body)
      try {
        const group = await prisma.group.update({
          where: { id: request.params.id },
          data: body,
        })
        return group
      } catch {
        reply.status(404).send({ message: 'Group not found' })
      }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/:id',
      { preHandler: requireAdminOrAdminSecret },
    async (request, reply) => {
      try {
        await prisma.group.delete({ where: { id: request.params.id } })
        return { ok: true }
      } catch {
        reply.status(404).send({ message: 'Group not found' })
      }
    }
  )
}
