import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret, requireAuthOrAdminSecret } from '../plugins/auth'
import { CreateGroupSchema, UpdateGroupSchema } from '@packman/shared'
import { cached, invalidate } from '../services/cache'

const GROUPS_CACHE_KEY = 'groups:all'
const GROUPS_TTL_MS = 60_000 // 1 minute

export async function groupRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuthOrAdminSecret }, async () => {
    return cached(GROUPS_CACHE_KEY, GROUPS_TTL_MS, () =>
      prisma.group.findMany({ orderBy: { name: 'asc' } })
    )
  })

  app.post('/', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const body = CreateGroupSchema.parse(request.body)
    const group = await prisma.group.create({ data: body })
    invalidate(GROUPS_CACHE_KEY)
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
        invalidate(GROUPS_CACHE_KEY)
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
        invalidate(GROUPS_CACHE_KEY)
        return reply.status(204).send()
      } catch {
        reply.status(404).send({ message: 'Group not found' })
      }
    }
  )
}
