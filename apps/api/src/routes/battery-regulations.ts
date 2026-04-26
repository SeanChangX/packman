import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret, requireAuthOrAdminSecret } from '../plugins/auth'
import { CreateBatteryRegulationSchema, UpdateBatteryRegulationSchema } from '@packman/shared'

export async function batteryRegulationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuthOrAdminSecret }, async () => {
    return prisma.batteryRegulation.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  })

  app.post('/', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const body = CreateBatteryRegulationSchema.parse(request.body)
    const regulation = await prisma.batteryRegulation.create({ data: body })
    return reply.status(201).send(regulation)
  })

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdminOrAdminSecret },
    async (request, reply) => {
      const body = UpdateBatteryRegulationSchema.parse(request.body)
      try {
        return await prisma.batteryRegulation.update({
          where: { id: request.params.id },
          data: body,
        })
      } catch {
        reply.status(404).send({ message: 'Battery regulation not found' })
      }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdminOrAdminSecret },
    async (request, reply) => {
      try {
        await prisma.batteryRegulation.delete({ where: { id: request.params.id } })
        return { ok: true }
      } catch {
        reply.status(404).send({ message: 'Battery regulation not found' })
      }
    }
  )
}
