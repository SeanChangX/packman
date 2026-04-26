import { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { prisma } from '../plugins/prisma'
import { requireAuth, requireAdmin } from '../plugins/auth'
import { CreateItemSchema, UpdateItemSchema } from '@packman/shared'
import { uploadToMinio, getPresignedUrl } from '../services/minio'
import { triggerAiTagging } from '../services/ollama'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

const itemInclude = {
  owner: { select: { id: true, name: true, avatarUrl: true } },
  createdBy: { select: { id: true, name: true } },
  group: true,
  box: { select: { id: true, label: true, shippingMethod: true } },
}

export async function itemRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const q = request.query as Record<string, string>
    const page = parseInt(q.page ?? '1', 10)
    const pageSize = Math.min(parseInt(q.pageSize ?? '50', 10), 100)

    const where: Record<string, any> = {}
    if (q.groupId) where.groupId = q.groupId
    if (q.boxId) where.boxId = q.boxId
    if (q.status) where.status = q.status
    if (q.shippingMethod) where.shippingMethod = q.shippingMethod
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' }

    const [data, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: itemInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.item.count({ where }),
    ])

    return { data, total, page, pageSize }
  })

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const item = await prisma.item.findUnique({
        where: { id: request.params.id },
        include: itemInclude,
      })
      if (!item) return reply.status(404).send({ message: 'Item not found' })
      return item
    }
  )

  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const body = CreateItemSchema.parse(request.body)
    const item = await prisma.item.create({
      data: { ...body, createdById: request.userId },
      include: itemInclude,
    })
    return reply.status(201).send(item)
  })

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = UpdateItemSchema.parse(request.body)
      try {
        const item = await prisma.item.update({
          where: { id: request.params.id },
          data: body,
          include: itemInclude,
        })
        return item
      } catch {
        reply.status(404).send({ message: 'Item not found' })
      }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        await prisma.item.delete({ where: { id: request.params.id } })
        return { ok: true }
      } catch {
        reply.status(404).send({ message: 'Item not found' })
      }
    }
  )

  // Upload photo: save to MinIO, trigger Ollama async tagging
  app.post<{ Params: { id: string } }>(
    '/:id/photo',
    { preHandler: requireAuth },
    async (request, reply) => {
      const item = await prisma.item.findUnique({ where: { id: request.params.id } })
      if (!item) return reply.status(404).send({ message: 'Item not found' })

      const data = await request.file()
      if (!data) return reply.status(400).send({ message: 'No file uploaded' })

      const ext = data.filename.split('.').pop() ?? 'jpg'
      const objectName = `items/${item.id}/photo.${ext}`

      const buffer = await data.toBuffer()
      await uploadToMinio(objectName, buffer, data.mimetype)

      const photoUrl = await getPresignedUrl(objectName)

      await prisma.item.update({
        where: { id: item.id },
        data: { photoUrl, aiTagStatus: 'PENDING' },
      })

      // Trigger AI tagging in the background (non-blocking)
      triggerAiTagging(item.id, buffer).catch((err) =>
        app.log.error({ err, itemId: item.id }, 'AI tagging failed')
      )

      return { photoUrl }
    }
  )

  // QR code PNG
  app.get<{ Params: { id: string } }>(
    '/:id/qr',
    { preHandler: requireAuth },
    async (request, reply) => {
      const url = `${APP_URL}/items/${request.params.id}`
      const png = await QRCode.toBuffer(url, { width: 300, margin: 2 })
      reply.type('image/png').send(png)
    }
  )
}
