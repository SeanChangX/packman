import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../plugins/prisma'

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET ?? ''

async function requireAdminSecret(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers['x-admin-auth']
  if (!ADMIN_API_SECRET || header !== ADMIN_API_SECRET) {
    reply.status(403).send({ message: 'Forbidden' })
  }
}

function toCsvRow(row: Record<string, unknown>): string {
  return Object.values(row)
    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',')
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.join(','), ...rows.map(toCsvRow)].join('\n')
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdminSecret)

  app.get('/users', async () => {
    return prisma.user.findMany({
      include: { group: true },
      orderBy: { name: 'asc' },
    })
  })

  app.patch<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const body = request.body as { role?: string; groupId?: string | null }
    try {
      const user = await prisma.user.update({
        where: { id: request.params.id },
        data: {
          ...(body.role && { role: body.role as any }),
          ...(body.groupId !== undefined && { groupId: body.groupId }),
        },
        include: { group: true },
      })
      return user
    } catch {
      reply.status(404).send({ message: 'User not found' })
    }
  })

  app.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    if (request.params.id === request.userId) {
      return reply.status(400).send({ message: 'Cannot delete yourself' })
    }
    try {
      await prisma.user.delete({ where: { id: request.params.id } })
      return { ok: true }
    } catch {
      reply.status(404).send({ message: 'User not found' })
    }
  })

  app.get('/stats', async () => {
    const [users, groups, boxes, items, batteries, packedItems, sealedBoxes] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.box.count(),
      prisma.item.count(),
      prisma.battery.count(),
      prisma.item.count({ where: { status: { in: ['PACKED', 'SEALED'] } } }),
      prisma.box.count({ where: { status: 'SEALED' } }),
    ])
    return { users, groups, boxes, items, batteries, packedItems, sealedBoxes }
  })

  app.get('/export/items', async (request, reply) => {
    const items = await prisma.item.findMany({
      include: {
        owner: { select: { name: true } },
        group: { select: { name: true } },
        box: { select: { label: true } },
      },
      orderBy: { name: 'asc' },
    })

    const headers = ['ID', 'Name', 'Owner', 'Group', 'Box', 'Shipping', 'Quantity', 'Status', 'Use Category', 'Tags', 'Notes', 'Created At']
    const rows = items.map((i) => ({
      id: i.id,
      name: i.name,
      owner: i.owner?.name ?? '',
      group: i.group?.name ?? '',
      box: i.box?.label ?? '',
      shipping: i.shippingMethod ?? '',
      quantity: i.quantity,
      status: i.status,
      useCategory: i.useCategory ?? '',
      tags: i.tags.join('; '),
      notes: i.notes ?? '',
      createdAt: i.createdAt.toISOString(),
    }))

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="items.csv"')
      .send('﻿' + toCsv(headers, rows)) // BOM for Excel UTF-8
  })

  app.get('/export/batteries', async (request, reply) => {
    const batteries = await prisma.battery.findMany({
      include: { owner: { select: { name: true } } },
      orderBy: { batteryId: 'asc' },
    })

    const headers = ['Battery ID', 'Type', 'Owner', 'Notes', 'Created At']
    const rows = batteries.map((b) => ({
      batteryId: b.batteryId,
      type: b.batteryType,
      owner: b.owner?.name ?? '',
      notes: b.notes ?? '',
      createdAt: b.createdAt.toISOString(),
    }))

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="batteries.csv"')
      .send('﻿' + toCsv(headers, rows))
  })
}
