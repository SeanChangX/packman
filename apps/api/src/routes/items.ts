import { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { prisma } from '../plugins/prisma'
import { requireAuth, requireAdmin } from '../plugins/auth'
import { CreateItemSchema, UpdateItemSchema } from '@packman/shared'
import { uploadToMinio, getPresignedUrl, deleteObject, objectNameFromUrl } from '../services/minio'
import { enqueueAiTagJob } from '../services/ai-tag-queue'
import { getAppConfig } from '../services/runtime-config'

const itemInclude = {
  owner: { select: { id: true, name: true, avatarUrl: true } },
  createdBy: { select: { id: true, name: true } },
  group: true,
  box: { select: { id: true, label: true, shippingMethod: true } },
  aiTagJobs: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
}

export async function itemRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const q = request.query as Record<string, string>
    const page = parseInt(q.page ?? '1', 10)
    const pageSize = Math.min(parseInt(q.pageSize ?? '50', 10), 100)
    const search = q.search?.trim()
    const tagMatchedIds = search
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Item"
          WHERE EXISTS (
            SELECT 1
            FROM unnest("tags") AS tag
            WHERE tag ILIKE ${`%${search}%`}
          )
          LIMIT 1000
        `
      : []

    const where: Record<string, any> = {}
    if (q.groupId) where.groupId = q.groupId
    if (q.boxId) where.boxId = q.boxId
    if (q.status) where.status = q.status
    if (q.shippingMethod) where.shippingMethod = q.shippingMethod
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { id: { in: tagMatchedIds.map((item) => item.id) } },
      ]
    }

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
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        await prisma.item.delete({ where: { id: request.params.id } })
        return reply.status(204).send()
      } catch {
        reply.status(404).send({ message: 'Item not found' })
      }
    }
  )

  // Upload photo: save to MinIO, queue Ollama tagging
  app.post<{ Params: { id: string } }>(
    '/:id/photo',
    { preHandler: requireAuth },
    async (request, reply) => {
      const item = await prisma.item.findUnique({ where: { id: request.params.id } })
      if (!item) return reply.status(404).send({ message: 'Item not found' })

      const data = await request.file()
      if (!data) return reply.status(400).send({ message: 'No file uploaded' })

      const ext = data.filename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
      const objectName = `items/${item.id}/photos/${Date.now()}.${ext}`

      const buffer = await data.toBuffer()
      await uploadToMinio(objectName, buffer, data.mimetype)

      const photoUrl = await getPresignedUrl(objectName)
      const previousObjectName = objectNameFromUrl(item.photoUrl)

      await prisma.item.update({
        where: { id: item.id },
        data: { photoUrl, aiTagStatus: 'PENDING' },
      })

      await enqueueAiTagJob(item.id, objectName)
      if (previousObjectName && previousObjectName !== objectName) {
        deleteObject(previousObjectName).catch((err) =>
          app.log.warn({ err, itemId: item.id, objectName: previousObjectName }, 'Old item photo cleanup failed')
        )
      }

      return { photoUrl }
    }
  )

  app.post<{ Params: { id: string } }>(
    '/:id/retag',
    { preHandler: requireAuth },
    async (request, reply) => {
      const item = await prisma.item.findUnique({ where: { id: request.params.id } })
      if (!item) return reply.status(404).send({ message: 'Item not found' })

      const objectName = objectNameFromUrl(item.photoUrl)
      if (!objectName) return reply.status(400).send({ message: '此物品尚無可辨識的照片' })

      await prisma.item.update({
        where: { id: item.id },
        data: { aiTagStatus: 'PENDING' },
      })
      await enqueueAiTagJob(item.id, objectName)
      return { ok: true }
    }
  )

  app.post(
    '/batch-delete',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { ids } = request.body as { ids: string[] }
      if (!ids?.length) return reply.status(400).send({ message: 'No ids provided' })
      await prisma.item.deleteMany({ where: { id: { in: ids } } })
      return reply.status(204).send()
    }
  )

  // QR code PNG
  app.get<{ Params: { id: string } }>(
    '/:id/qr',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { appUrl } = await getAppConfig()
      const url = `${appUrl}/items/${request.params.id}`
      const png = await QRCode.toBuffer(url, { width: 300, margin: 2 })
      reply.type('image/png').send(png)
    }
  )
}
