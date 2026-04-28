import { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'
import { prisma } from '../plugins/prisma'
import { requireAdminOrAdminSecret } from '../plugins/auth'
import {
  CreateOllamaEndpointSchema,
  CreateSelectOptionSchema,
  UpdateAdminAccountSchema,
  UpdateAppSettingsSchema,
  UpdateOllamaConfigSchema,
  UpdateOllamaEndpointSchema,
  UpdateSelectOptionSchema,
  UpdateSlackSettingsSchema,
} from '@packman/shared'
import {
  analyzeImageWithOllama,
  listOllamaModelStatus,
  updateOllamaConfig,
} from '../services/ollama'
import {
  getAdminAuthStatus,
  getAppConfig,
  getSlackConfig,
  updateAdminAccount,
  updateAppConfig,
  updateSlackConfig,
} from '../services/runtime-config'

function toCsvRow(row: Record<string, unknown>): string {
  return Object.values(row)
    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',')
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.join(','), ...rows.map(toCsvRow)].join('\n')
}

async function ollamaConfigWithJobStats() {
  const [config, queued, running, done, failed, cancelled] = await Promise.all([
    listOllamaModelStatus(),
    prisma.aiTagJob.count({ where: { status: 'QUEUED' } }),
    prisma.aiTagJob.count({ where: { status: 'RUNNING' } }),
    prisma.aiTagJob.count({ where: { status: 'DONE' } }),
    prisma.aiTagJob.count({ where: { status: 'FAILED' } }),
    prisma.aiTagJob.count({ where: { status: 'CANCELLED' } }),
  ])
  return {
    ...config,
    aiTagJobs: { queued, running, done, failed, cancelled },
  }
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdminOrAdminSecret)

  app.get('/settings', async () => {
    const [appConfig, slack, admin] = await Promise.all([
      getAppConfig(),
      getSlackConfig(),
      getAdminAuthStatus(),
    ])
    return {
      app: appConfig,
      slack: {
        clientId: slack.clientId,
        clientSecretSet: slack.clientSecretSet,
        workspaceId: slack.workspaceId,
        redirectUri: slack.redirectUri,
      },
      admin,
    }
  })

  app.patch('/settings/app', async (request) => {
    const body = UpdateAppSettingsSchema.parse(request.body)
    return updateAppConfig(body)
  })

  app.patch('/settings/slack', async (request) => {
    const body = UpdateSlackSettingsSchema.parse(request.body)
    return updateSlackConfig({
      ...body,
      clientSecret: body.clientSecret?.trim() || undefined,
    })
  })

  app.patch('/settings/admin-account', async (request) => {
    const body = UpdateAdminAccountSchema.parse(request.body)
    return updateAdminAccount({
      username: body.username,
      password: body.password || undefined,
    })
  })

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
      return reply.status(204).send()
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
    const value = body.value ?? randomBytes(4).toString('hex').toUpperCase()
    try {
      const opt = await prisma.selectOption.create({ data: { ...body, value } })
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
      const status = await ollamaConfigWithJobStats()
      const ok = status.endpoints.some((endpoint) => endpoint.enabled && endpoint.ok)
      return {
        ok,
        ...status,
        message: ok ? undefined : 'Ollama 無法連線',
      }
    } catch (err: any) {
      return reply.status(503).send({ ok: false, message: err?.message ?? 'Ollama 無法連線' })
    }
  })

  app.get('/ollama-config', async () => ollamaConfigWithJobStats())

  app.patch('/ollama-config', async (request) => {
    const body = UpdateOllamaConfigSchema.parse(request.body)
    await updateOllamaConfig(body)
    return ollamaConfigWithJobStats()
  })

  app.post('/ollama-endpoints', async (request, reply) => {
    const body = CreateOllamaEndpointSchema.parse(request.body)
    const endpoint = await prisma.ollamaEndpoint.create({
      data: { ...body, baseUrl: body.baseUrl.replace(/\/+$/, '') },
    })
    return reply.status(201).send(endpoint)
  })

  app.patch<{ Params: { id: string } }>('/ollama-endpoints/:id', async (request, reply) => {
    const body = UpdateOllamaEndpointSchema.parse(request.body)
    try {
      return await prisma.ollamaEndpoint.update({
        where: { id: request.params.id },
        data: {
          ...body,
          ...(body.baseUrl ? { baseUrl: body.baseUrl.replace(/\/+$/, '') } : {}),
        },
      })
    } catch {
      return reply.status(404).send({ message: 'Ollama endpoint not found' })
    }
  })

  app.delete<{ Params: { id: string } }>('/ollama-endpoints/:id', async (request, reply) => {
    try {
      await prisma.ollamaEndpoint.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ message: 'Ollama endpoint not found' })
    }
  })

  app.post('/ollama-test', async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ message: '請上傳圖片' })

    const raw = await data.toBuffer()
    try {
      const result = await analyzeImageWithOllama(raw)
      return { ok: true, ...result }
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
