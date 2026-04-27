import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth, requireAdmin } from '../plugins/auth'
import { CreateBatterySchema, UpdateBatterySchema } from '@packman/shared'

const batteryInclude = {
  owner: { select: { id: true, name: true, avatarUrl: true } },
}

export async function batteryRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const q = request.query as Record<string, string>
    const where: Record<string, any> = {}
    if (q.batteryType) where.batteryType = q.batteryType
    if (q.ownerId) where.ownerId = q.ownerId

    return prisma.battery.findMany({
      where,
      include: batteryInclude,
      orderBy: { batteryId: 'asc' },
    })
  })

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const battery = await prisma.battery.findUnique({
        where: { id: request.params.id },
        include: batteryInclude,
      })
      if (!battery) return reply.status(404).send({ message: 'Battery not found' })
      return battery
    }
  )

  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const body = CreateBatterySchema.parse(request.body)
    try {
      const battery = await prisma.battery.create({ data: body, include: batteryInclude })
      return reply.status(201).send(battery)
    } catch {
      reply.status(409).send({ message: 'Battery ID already exists' })
    }
  })

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = UpdateBatterySchema.parse(request.body)
      try {
        const battery = await prisma.battery.update({
          where: { id: request.params.id },
          data: body,
          include: batteryInclude,
        })
        return battery
      } catch {
        reply.status(404).send({ message: 'Battery not found' })
      }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        await prisma.battery.delete({ where: { id: request.params.id } })
        return reply.status(204).send()
      } catch {
        reply.status(404).send({ message: 'Battery not found' })
      }
    }
  )
}
