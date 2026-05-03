import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret, requireAuthOrAdminSecret } from '../plugins/auth'
import { CreateEventSchema, UpdateEventSchema } from '@packman/shared'
import { getActiveEventId } from '../services/events'
import { t } from '../lib/i18n'

export async function eventRoutes(app: FastifyInstance) {
  app.get('/active', { preHandler: requireAuthOrAdminSecret }, async () => {
    const activeId = await getActiveEventId().catch(() => null)
    if (!activeId) return null
    return prisma.event.findUnique({ where: { id: activeId } })
  })

  app.get('/', { preHandler: requireAdminOrAdminSecret }, async () => {
    const activeId = await getActiveEventId().catch(() => null)
    const events = await prisma.event.findMany({
      include: { _count: { select: { items: true, boxes: true, batteries: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return events.map(({ _count, ...e }) => ({
      ...e,
      isActive: e.id === activeId,
      itemCount: _count.items,
      boxCount: _count.boxes,
      batteryCount: _count.batteries,
    }))
  })

  app.post('/', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const { name } = CreateEventSchema.parse(request.body)
    const event = await prisma.event.create({ data: { name } })
    return reply.status(201).send(event)
  })

  app.patch<{ Params: { id: string } }>('/:id', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const { name } = UpdateEventSchema.parse(request.body)
    try {
      return await prisma.event.update({ where: { id: request.params.id }, data: { name } })
    } catch {
      return reply.status(404).send({ message: 'Event not found' })
    }
  })

  app.post<{ Params: { id: string } }>('/:id/activate', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const event = await prisma.event.findUnique({ where: { id: request.params.id } })
    if (!event) return reply.status(404).send({ message: 'Event not found' })
    await prisma.systemSetting.upsert({
      where: { key: 'activeEventId' },
      update: { value: event.id },
      create: { key: 'activeEventId', value: event.id },
    })
    return { activeEventId: event.id }
  })

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const event = await prisma.event.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { items: true, boxes: true, batteries: true } } },
    })
    if (!event) return reply.status(404).send({ message: 'Event not found' })

    const activeId = await getActiveEventId().catch(() => null)
    if (event.id === activeId) return reply.status(400).send({ message: t(request, 'events.error.deleteActive') })

    const total = event._count.items + event._count.boxes + event._count.batteries
    if (total > 0) return reply.status(400).send({ message: t(request, 'events.error.hasData', { count: total }) })

    await prisma.event.delete({ where: { id: event.id } })
    return reply.status(204).send()
  })
}
