import { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { prisma } from '../plugins/prisma'
import { requireAuth, requireAdmin } from '../plugins/auth'
import { CreateBoxSchema, UpdateBoxSchema } from '@packman/shared'
import { generateBoxStickerPdf } from '../services/pdf'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

const boxInclude = {
  owner: { select: { id: true, name: true, avatarUrl: true } },
}

export async function boxRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const query = request.query as { shippingMethod?: string }
    return prisma.box.findMany({
      where: query.shippingMethod
        ? { shippingMethod: query.shippingMethod as any }
        : undefined,
      include: {
        ...boxInclude,
        _count: { select: { items: true } },
      },
      orderBy: { label: 'asc' },
    })
  })

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
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

  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = CreateBoxSchema.parse(request.body)
    const box = await prisma.box.create({ data: body, include: boxInclude })
    return reply.status(201).send(box)
  })

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
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
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        await prisma.box.delete({ where: { id: request.params.id } })
        return { ok: true }
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
      const url = `${APP_URL}/boxes/${request.params.id}`
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
      const pdfBuffer = await generateBoxStickerPdf([box], APP_URL, size)

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="box-${box.label}-sticker.pdf"`)
        .send(pdfBuffer)
    }
  )
}
