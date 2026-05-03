import { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { prisma } from '../plugins/prisma'
import { requireAuth, requireAdminOrAdminSecret, requireAuthOrAdminSecret } from '../plugins/auth'
import { CreateBoxSchema, UpdateBoxSchema } from '@packman/shared'
import { generateBoxStickerPdf } from '../services/pdf'
import { getAppConfig, getBrandConfig, getBrandLogoBuffer } from '../services/runtime-config'
import { getObjectBuffer } from '../services/minio'
import { getActiveEventId } from '../services/events'
import { resolveLocale } from '../lib/i18n'

const boxInclude = {
  owner: { select: { id: true, name: true, avatarUrl: true } },
}

export async function boxRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuthOrAdminSecret }, async (request) => {
    const query = request.query as { shippingMethod?: string }
    const eventId = await getActiveEventId()
    const boxes = await prisma.box.findMany({
      where: { eventId, ...(query.shippingMethod ? { shippingMethod: query.shippingMethod as any } : {}) },
      include: boxInclude,
      orderBy: { label: 'asc' },
    })
    if (boxes.length === 0) return []

    const boxIds = boxes.map((b) => b.id)
    const aggregates = await prisma.$queryRaw<Array<{ boxId: string; itemCount: bigint; totalWeightG: bigint | null }>>`
      SELECT "boxId", COUNT(*)::bigint AS "itemCount",
             COALESCE(SUM(COALESCE("weightG", 0) * "quantity"), 0)::bigint AS "totalWeightG"
      FROM "Item"
      WHERE "boxId" = ANY(${boxIds}::text[])
      GROUP BY "boxId"
    `
    const aggMap = new Map(aggregates.map((a) => [a.boxId, a]))
    return boxes.map((box) => {
      const agg = aggMap.get(box.id)
      return {
        ...box,
        itemCount: agg ? Number(agg.itemCount) : 0,
        totalWeightG: agg ? Number(agg.totalWeightG ?? 0) : 0,
      }
    })
  })

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuthOrAdminSecret },
    async (request, reply) => {
      const box = await prisma.box.findUnique({
        where: { id: request.params.id },
        include: {
          ...boxInclude,
          items: {
            include: {
              owner: { select: { id: true, name: true, avatarUrl: true } },
              group: true,
            },
            orderBy: { name: 'asc' },
          },
        },
      })
      if (!box) return reply.status(404).send({ message: 'Box not found' })
      return box
    }
  )

  app.post('/', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const body = CreateBoxSchema.parse(request.body)
    const eventId = await getActiveEventId()
    const box = await prisma.box.create({ data: { ...body, eventId }, include: boxInclude })
    return reply.status(201).send(box)
  })

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdminOrAdminSecret },
    async (request, reply) => {
      const body = UpdateBoxSchema.parse(request.body)
      try {
        const box = await prisma.box.update({
          where: { id: request.params.id },
          data: body,
          include: boxInclude,
        })
        return box
      } catch {
        reply.status(404).send({ message: 'Box not found' })
      }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdminOrAdminSecret },
    async (request, reply) => {
      try {
        await prisma.box.delete({ where: { id: request.params.id } })
        return reply.status(204).send()
      } catch {
        reply.status(404).send({ message: 'Box not found' })
      }
    }
  )

  // QR code PNG for a box
  app.get<{ Params: { id: string } }>(
    '/:id/qr',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { appUrl } = await getAppConfig()
      const url = `${appUrl}/boxes/${request.params.id}`
      const png = await QRCode.toBuffer(url, { width: 300, margin: 2 })
      reply.type('image/png').send(png)
    }
  )

  // Sticker PDF for a single box
  app.get<{ Params: { id: string }; Querystring: { size?: string } }>(
    '/:id/sticker',
    { preHandler: requireAuth },
    async (request, reply) => {
      const box = await prisma.box.findUnique({
        where: { id: request.params.id },
        include: {
          owner: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      })
      if (!box) return reply.status(404).send({ message: 'Box not found' })

      const size = (request.query.size as any) ?? 'MEDIUM'
      const [{ appUrl }, brand] = await Promise.all([getAppConfig(), getBrandConfig()])
      const logoBuffer = await getBrandLogoBuffer()
        ?? (brand.logoObjectName ? await getObjectBuffer(brand.logoObjectName).catch(() => null) : null)
      const pdfBuffer = await generateBoxStickerPdf([box], appUrl, size, logoBuffer, brand.name, resolveLocale(request))

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`box-${box.label}-sticker.pdf`)}`)
        .send(pdfBuffer)
    }
  )
}
