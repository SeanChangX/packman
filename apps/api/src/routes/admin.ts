import { FastifyInstance } from 'fastify'
import axios from 'axios'
import sharp from 'sharp'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret } from '../plugins/auth'
import { CreateSelectOptionSchema, UpdateSelectOptionSchema } from '@packman/shared'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL ?? 'llava'
const TAG_PROMPT =
  '請用繁體中文列出這個物品的5個簡短標籤，只需要輸出標籤，用逗號分隔，不要有其他說明。例如：電子設備, 充電器, 攜帶型, 黑色, 科技'

function toCsvRow(row: Record<string, unknown>): string {
  return Object.values(row)
    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',')
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.join(','), ...rows.map(toCsvRow)].join('\n')
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdminOrAdminSecret)

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

  app.get('/select-options', async (request) => {
    const q = request.query as Record<string, string>
    const where = q.type ? { type: q.type as any } : {}
    return prisma.selectOption.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    })
  })

  app.post('/select-options', async (request, reply) => {
    const body = CreateSelectOptionSchema.parse(request.body)
    try {
      const opt = await prisma.selectOption.create({ data: body })
      return reply.status(201).send(opt)
    } catch {
      reply.status(409).send({ message: '該類型中已有相同 value' })
    }
  })

  app.patch<{ Params: { id: string } }>('/select-options/:id', async (request, reply) => {
    const body = UpdateSelectOptionSchema.parse(request.body)
    try {
      return await prisma.selectOption.update({ where: { id: request.params.id }, data: body })
    } catch {
      reply.status(404).send({ message: 'Option not found' })
    }
  })

  app.delete<{ Params: { id: string } }>('/select-options/:id', async (request, reply) => {
    try {
      await prisma.selectOption.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    } catch {
      reply.status(404).send({ message: 'Option not found' })
    }
  })

  app.get('/ollama-status', async (_request, reply) => {
    try {
      const res = await axios.get<{ models: { name: string }[] }>(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 })
      const models = res.data.models?.map((m) => m.name) ?? []
      return { ok: true, models, activeModel: OLLAMA_MODEL }
    } catch {
      return reply.status(503).send({ ok: false, message: 'Ollama 無法連線' })
    }
  })

  app.post('/ollama-test', async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ message: '請上傳圖片' })

    const raw = await data.toBuffer()
    const resized = await sharp(raw)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const base64Image = resized.toString('base64')

    try {
      const response = await axios.post<{ response: string }>(
        `${OLLAMA_BASE_URL}/api/generate`,
        { model: OLLAMA_MODEL, prompt: TAG_PROMPT, images: [base64Image], stream: false },
        { timeout: 60_000 }
      )

      const rawText = response.data.response.trim()
      const tags = rawText
        .split(/[,，、]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 30)
        .slice(0, 8)

      return { ok: true, tags, raw: rawText, model: OLLAMA_MODEL }
    } catch (err: any) {
      return reply.status(503).send({ ok: false, message: err?.message ?? 'Ollama 請求失敗' })
    }
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
