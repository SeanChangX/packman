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
  getBrandConfig,
  getBrandLogoBuffer,
  updateBrandName,
  setBrandLogoData,
  setBrandLogoObjectName,
} from '../services/runtime-config'
import { deleteObject, getObjectBuffer, listAllObjectNames, uploadToMinio } from '../services/minio'
import AdmZip from 'adm-zip'
import { invalidate } from '../services/cache'
import sharp from 'sharp'
import { getActiveEventId } from '../services/events'

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

const brandLogoUrl = '/api/admin/settings/brand/logo'

function brandPayload(brand: { name: string; logoObjectName: string | null; logoData: string | null }) {
  return {
    name: brand.name,
    logoUrl: brand.logoData || brand.logoObjectName ? brandLogoUrl : null,
  }
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdminOrAdminSecret)

  app.get('/settings', async () => {
    const [appConfig, slack, admin, brand] = await Promise.all([
      getAppConfig(),
      getSlackConfig(),
      getAdminAuthStatus(),
      getBrandConfig(),
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
      brand: brandPayload(brand),
    }
  })

  app.patch('/settings/brand', async (request) => {
    const body = request.body as { name?: string }
    await updateBrandName(body.name ?? '')
    const brand = await getBrandConfig()
    return brandPayload(brand)
  })

  app.get('/settings/brand/logo', async (request, reply) => {
    const brand = await getBrandConfig()
    const buffer = await getBrandLogoBuffer()
      ?? (brand.logoObjectName ? await getObjectBuffer(brand.logoObjectName).catch(() => null) : null)
    if (!buffer) return reply.status(404).send({ message: 'Logo not found' })

    return reply
      .header('Cache-Control', 'private, max-age=300')
      .type('image/png')
      .send(buffer)
  })

  app.post('/settings/brand/logo', async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ message: '請上傳圖片' })

    const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!ALLOWED.includes(data.mimetype)) {
      return reply.status(400).send({ message: '僅支援 PNG、JPG、WebP、SVG' })
    }

    const raw = await data.toBuffer()
    const png = await sharp(raw).resize({ width: 400, height: 200, fit: 'inside', withoutEnlargement: true }).png().toBuffer()

    const prev = await getBrandConfig()
    if (prev.logoObjectName) {
      await deleteObject(prev.logoObjectName).catch(() => {})
    }

    await setBrandLogoData(png)
    await setBrandLogoObjectName(null)
    const brand = await getBrandConfig()
    return brandPayload(brand)
  })

  app.delete('/settings/brand/logo', async (request, reply) => {
    const brand = await getBrandConfig()
    if (brand.logoObjectName) {
      await deleteObject(brand.logoObjectName).catch(() => {})
    }
    await setBrandLogoData(null)
    await setBrandLogoObjectName(null)
    return reply.status(204).send()
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
    const eventId = await getActiveEventId().catch(() => null)
    const scopedWhere = eventId ? { eventId } : {}
    const [users, groups, boxes, items, batteries, packedItems, sealedBoxes] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.box.count({ where: scopedWhere }),
      prisma.item.count({ where: scopedWhere }),
      prisma.battery.count({ where: scopedWhere }),
      prisma.item.count({ where: { ...scopedWhere, status: { in: ['PACKED', 'SEALED'] } } }),
      prisma.box.count({ where: { ...scopedWhere, status: 'SEALED' } }),
    ])
    return { users, groups, boxes, items, batteries, packedItems, sealedBoxes }
  })

  app.get('/export/items', async (request, reply) => {
    const eventId = await getActiveEventId()
    const items = await prisma.item.findMany({
      where: { eventId },
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
      invalidate('selectOptions')
      return reply.status(201).send(opt)
    } catch {
      reply.status(409).send({ message: '該類型中已有相同 value' })
    }
  })

  app.patch<{ Params: { id: string } }>('/select-options/:id', async (request, reply) => {
    const body = UpdateSelectOptionSchema.parse(request.body)
    try {
      const opt = await prisma.selectOption.update({ where: { id: request.params.id }, data: body })
      invalidate('selectOptions')
      return opt
    } catch {
      reply.status(404).send({ message: 'Option not found' })
    }
  })

  app.delete<{ Params: { id: string } }>('/select-options/:id', async (request, reply) => {
    try {
      await prisma.selectOption.delete({ where: { id: request.params.id } })
      invalidate('selectOptions')
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
    const eventId = await getActiveEventId()
    const batteries = await prisma.battery.findMany({
      where: { eventId },
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

  app.get('/export/backup', async (request, reply) => {
    void request
    const [events, activeEventId, items, boxes, batteries, groups, users, selectOptions, batteryRegulations, systemSettings, ollamaEndpoints] = await Promise.all([
      prisma.event.findMany({ orderBy: { createdAt: 'asc' } }),
      getActiveEventId().catch(() => null),
      prisma.item.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.box.findMany({ orderBy: { label: 'asc' } }),
      prisma.battery.findMany({ orderBy: { batteryId: 'asc' } }),
      prisma.group.findMany({ orderBy: { name: 'asc' } }),
      prisma.user.findMany({ orderBy: { name: 'asc' } }),
      prisma.selectOption.findMany({ orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.batteryRegulation.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.systemSetting.findMany(),
      prisma.ollamaEndpoint.findMany({ orderBy: { createdAt: 'asc' } }),
    ])

    const zip = new AdmZip()
    const data = { exportedAt: new Date().toISOString(), version: '1.2', activeEventId, events, items, boxes, batteries, groups, users, selectOptions, batteryRegulations, systemSettings, ollamaEndpoints }
    zip.addFile('data.json', Buffer.from(JSON.stringify(data, null, 2), 'utf-8'))

    const objectNames = await listAllObjectNames().catch(() => [] as string[])
    for (const name of objectNames) {
      try {
        const buf = await getObjectBuffer(name)
        zip.addFile(`photos/${name}`, buf)
      } catch (err) {
        request.log.warn({ err, name }, 'Backup: skipped unreadable object')
      }
    }

    const date = new Date().toISOString().slice(0, 10)
    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="packman-backup-${date}.zip"`)
      .send(zip.toBuffer())
  })

  app.post('/import/backup', async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ message: '請上傳備份檔' })

    const filename = data.filename ?? ''
    if (!filename.toLowerCase().endsWith('.zip') && data.mimetype !== 'application/zip' && data.mimetype !== 'application/x-zip-compressed') {
      return reply.status(400).send({ message: '請上傳 .zip 備份檔' })
    }

    const buf = await data.toBuffer()
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return reply.status(400).send({ message: '檔案不是有效的 ZIP 格式' })
    }

    let zip: AdmZip
    try { zip = new AdmZip(buf) } catch { return reply.status(400).send({ message: '無法讀取 ZIP 檔' }) }

    const dataEntry = zip.getEntry('data.json')
    if (!dataEntry) return reply.status(400).send({ message: '備份檔缺少 data.json' })

    let payload: any
    try { payload = JSON.parse(dataEntry.getData().toString('utf-8')) }
    catch { return reply.status(400).send({ message: 'data.json 格式錯誤' }) }

    if (!payload || typeof payload !== 'object') {
      return reply.status(400).send({ message: 'data.json 內容無效' })
    }
    if (typeof payload.version !== 'string' || !/^1\./.test(payload.version)) {
      return reply.status(400).send({ message: `不支援的備份版本：${payload.version ?? '未知'}（需 1.x）` })
    }
    const requiredArrays = ['events', 'users', 'groups', 'boxes', 'items', 'batteries', 'selectOptions', 'batteryRegulations', 'systemSettings']
    for (const key of requiredArrays) {
      if (!Array.isArray(payload[key])) {
        return reply.status(400).send({ message: `data.json 缺少欄位或格式錯誤：${key}` })
      }
    }
    if (payload.events.length === 0) {
      return reply.status(400).send({ message: '備份至少需包含一個 Event' })
    }

    const ALLOWED_PHOTO_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'])
    const photoEntries = zip.getEntries().filter((e) => {
      if (e.isDirectory) return false
      const name = e.entryName
      if (!name.startsWith('photos/')) return false
      if (name.includes('..') || name.startsWith('/')) return false
      const ext = name.split('.').pop()?.toLowerCase() ?? ''
      return ALLOWED_PHOTO_EXT.has(ext)
    })

    try {
      await prisma.$transaction(async (tx) => {
        await tx.aiTagJob.deleteMany({})
        await tx.item.deleteMany({})
        await tx.box.deleteMany({})
        await tx.battery.deleteMany({})
        await tx.batteryRegulation.deleteMany({})
        await tx.selectOption.deleteMany({})
        await tx.ollamaEndpoint.deleteMany({})
        await tx.user.deleteMany({})
        await tx.group.deleteMany({})
        await tx.event.deleteMany({})

        if (Array.isArray(payload.events)) await tx.event.createMany({ data: payload.events, skipDuplicates: true })
        if (Array.isArray(payload.groups)) await tx.group.createMany({ data: payload.groups, skipDuplicates: true })
        if (Array.isArray(payload.users)) await tx.user.createMany({ data: payload.users, skipDuplicates: true })
        if (Array.isArray(payload.boxes)) await tx.box.createMany({ data: payload.boxes, skipDuplicates: true })
        if (Array.isArray(payload.items)) await tx.item.createMany({ data: payload.items, skipDuplicates: true })
        if (Array.isArray(payload.batteries)) await tx.battery.createMany({ data: payload.batteries, skipDuplicates: true })
        if (Array.isArray(payload.selectOptions)) await tx.selectOption.createMany({ data: payload.selectOptions, skipDuplicates: true })
        if (Array.isArray(payload.batteryRegulations)) await tx.batteryRegulation.createMany({ data: payload.batteryRegulations, skipDuplicates: true })
        if (Array.isArray(payload.ollamaEndpoints)) await tx.ollamaEndpoint.createMany({ data: payload.ollamaEndpoints, skipDuplicates: true })

        if (Array.isArray(payload.systemSettings)) {
          for (const s of payload.systemSettings) {
            await tx.systemSetting.upsert({
              where: { key: s.key },
              update: { value: s.value },
              create: { key: s.key, value: s.value },
            })
          }
        }
        if (payload.activeEventId) {
          await tx.systemSetting.upsert({
            where: { key: 'activeEventId' },
            update: { value: payload.activeEventId },
            create: { key: 'activeEventId', value: payload.activeEventId },
          })
        }
      })
    } catch (err: any) {
      return reply.status(500).send({ message: `資料還原失敗：${err?.message ?? '未知錯誤'}` })
    }

    invalidate('groups:all')
    invalidate('selectOptions')

    let photoOk = 0
    let photoFail = 0
    for (const entry of photoEntries) {
      const objectName = entry.entryName.slice('photos/'.length)
      const ext = objectName.split('.').pop()?.toLowerCase()
      const contentType = ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : ext === 'gif' ? 'image/gif'
        : ext === 'heic' ? 'image/heic'
        : ext === 'heif' ? 'image/heif'
        : 'image/jpeg'
      try {
        await uploadToMinio(objectName, entry.getData(), contentType)
        photoOk++
      } catch (err) {
        photoFail++
        request.log.warn({ err, objectName }, 'Restore: photo upload failed')
      }
    }

    return { ok: true, photoOk, photoFail }
  })
}
