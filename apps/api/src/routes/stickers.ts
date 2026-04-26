import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret } from '../plugins/auth'
import { StickerRequestSchema } from '@packman/shared'
import { generateItemStickerPdf, generateBoxStickerPdf } from '../services/pdf'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function stickerRoutes(app: FastifyInstance) {
  // Bulk item stickers PDF
  app.post('/items', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const body = StickerRequestSchema.parse(request.body)

    const items = await prisma.item.findMany({
      where: { id: { in: body.ids } },
      include: {
        owner: { select: { name: true, email: true } },
        group: true,
        box: { select: { label: true } },
      },
    })

    const pdfBuffer = await generateItemStickerPdf(items, APP_URL, body.size)

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="item-stickers.pdf"')
      .send(pdfBuffer)
  })

  // Bulk box stickers PDF
  app.post('/boxes', { preHandler: requireAdminOrAdminSecret }, async (request, reply) => {
    const body = StickerRequestSchema.parse(request.body)

    const boxes = await prisma.box.findMany({
      where: { id: { in: body.ids } },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    })

    const pdfBuffer = await generateBoxStickerPdf(boxes, APP_URL, body.size)

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="box-stickers.pdf"')
      .send(pdfBuffer)
  })
}
