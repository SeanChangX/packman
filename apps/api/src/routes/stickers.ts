import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret } from '../plugins/auth'
import { StickerRequestSchema } from '@packman/shared'
import { generateItemStickerPdf, generateBoxStickerPdf } from '../services/pdf'
import { getAppConfig, getBrandConfig, getBrandLogoBuffer } from '../services/runtime-config'
import { getObjectBuffer } from '../services/minio'
import { resolveLocale } from '../lib/i18n'

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
    const itemMap = new Map(items.map((i) => [i.id, i]))
    const ordered = body.ids.map((id) => itemMap.get(id)).filter((i): i is NonNullable<typeof i> => i != null)

    const [{ appUrl }, brand] = await Promise.all([getAppConfig(), getBrandConfig()])
    const logoBuffer = await getBrandLogoBuffer()
      ?? (brand.logoObjectName ? await getObjectBuffer(brand.logoObjectName).catch(() => null) : null)
    const pdfBuffer = await generateItemStickerPdf(ordered, appUrl, body.size, logoBuffer, brand.name, resolveLocale(request))

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
    const boxMap = new Map(boxes.map((b) => [b.id, b]))
    const ordered = body.ids.map((id) => boxMap.get(id)).filter((b): b is NonNullable<typeof b> => b != null)

    const [{ appUrl }, brand] = await Promise.all([getAppConfig(), getBrandConfig()])
    const logoBuffer = await getBrandLogoBuffer()
      ?? (brand.logoObjectName ? await getObjectBuffer(brand.logoObjectName).catch(() => null) : null)
    const pdfBuffer = await generateBoxStickerPdf(ordered, appUrl, body.size, logoBuffer, brand.name, resolveLocale(request))

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="box-stickers.pdf"')
      .send(pdfBuffer)
  })
}
