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
import {
  deleteObject,
  getObjectBuffer,
  getObjectStream,
  listAllObjectNames,
  uploadStreamToMinio,
  uploadToMinio,
} from '../services/minio'
import archiver from 'archiver'
import unzipper from 'unzipper'
import { promises as fsp, createWriteStream } from 'fs'
import { tmpdir } from 'os'
import { join as pathJoin } from 'path'
import { pipeline } from 'stream/promises'
import { invalidate } from '../services/cache'
import sharp from 'sharp'
import { getActiveEventId } from '../services/events'
import { t } from '../lib/i18n'

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

// When preserveSecrets is on we only skip the admin login (username +
// passwordHash). Everything else — JWT/cookie secrets, Slack client secret,
// brand, app URLs — is restored as part of the backup.
function isSecretSettingKey(key: string): boolean {
  return key.startsWith('admin.')
}

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
    if (!data) return reply.status(400).send({ message: t(request, 'admin.error.uploadImage') })

    const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!ALLOWED.includes(data.mimetype)) {
      return reply.status(400).send({ message: t(request, 'admin.error.unsupportedImage') })
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

  app.get<{ Params: { id: string } }>('/users/:id/impact', async (request, reply) => {
    const id = request.params.id
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) return reply.status(404).send({ message: 'User not found' })
    const [ownedItems, ownedBoxes, ownedBatteries, createdItems] = await Promise.all([
      prisma.item.count({ where: { ownerId: id } }),
      prisma.box.count({ where: { ownerId: id } }),
      prisma.battery.count({ where: { ownerId: id } }),
      prisma.item.count({ where: { createdById: id } }),
    ])
    return { ownedItems, ownedBoxes, ownedBatteries, createdItems }
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
      reply.status(409).send({ message: t(request, 'admin.error.duplicateOptionValue') })
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

  app.get('/ollama-status', async (request, reply) => {
    try {
      const status = await ollamaConfigWithJobStats()
      const ok = status.endpoints.some((endpoint) => endpoint.enabled && endpoint.ok)
      return {
        ok,
        ...status,
        message: ok ? undefined : t(request, 'admin.error.ollamaUnreachable'),
      }
    } catch (err: any) {
      return reply.status(503).send({ ok: false, message: err?.message ?? t(request, 'admin.error.ollamaUnreachable') })
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
    if (!data) return reply.status(400).send({ message: t(request, 'admin.error.uploadImage') })

    const raw = await data.toBuffer()
    try {
      const result = await analyzeImageWithOllama(raw)
      return { ok: true, ...result }
    } catch (err: any) {
      return reply.status(503).send({ ok: false, message: err?.message ?? t(request, 'admin.error.ollamaRequestFailed') })
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

    const data = { exportedAt: new Date().toISOString(), version: '1.2', activeEventId, events, items, boxes, batteries, groups, users, selectOptions, batteryRegulations, systemSettings, ollamaEndpoints }
    const date = new Date().toISOString().slice(0, 10)

    // Stream the archive directly to the client. zlib level 0 (store) avoids
    // wasting CPU compressing photos that are already JPEG/PNG.
    const archive = archiver('zip', { zlib: { level: 0 } })

    reply.raw.setHeader('Content-Type', 'application/zip')
    reply.raw.setHeader('Content-Disposition', `attachment; filename="packman-backup-${date}.zip"`)
    reply.hijack()

    archive.on('warning', (err) => request.log.warn({ err }, 'archiver warning'))
    archive.on('error', (err) => {
      request.log.error({ err }, 'archiver error')
      reply.raw.destroy(err)
    })
    archive.pipe(reply.raw)

    // data.json is appended first so streaming readers can find it before any photo entry.
    archive.append(JSON.stringify(data, null, 2), { name: 'data.json' })

    const objectNames = await listAllObjectNames().catch(() => [] as string[])

    // Process photos sequentially: open one MinIO read stream at a time and wait
    // for archiver to finish each entry before starting the next. This keeps memory
    // usage flat and avoids exhausting MinIO connections regardless of photo count.
    for (const name of objectNames) {
      try {
        const stream = await getObjectStream(name)
        archive.append(stream, { name: `photos/${name}` })
        await new Promise<void>((resolve, reject) => {
          archive.once('entry', () => resolve())
          archive.once('error', reject)
        })
      } catch (err) {
        request.log.warn({ err, name }, 'Backup: skipped unreadable object')
      }
    }

    await archive.finalize()
  })

  app.post<{ Querystring: { preserveSecrets?: string } }>('/import/backup', async (request, reply) => {
    const preserveSecrets = request.query.preserveSecrets === '1' || request.query.preserveSecrets === 'true'
    const data = await request.file()
    if (!data) return reply.status(400).send({ message: t(request, 'admin.error.uploadBackup') })

    const filename = data.filename ?? ''
    if (!filename.toLowerCase().endsWith('.zip') && data.mimetype !== 'application/zip' && data.mimetype !== 'application/x-zip-compressed') {
      return reply.status(400).send({ message: t(request, 'admin.error.uploadZip') })
    }

    // Spool the upload to a temp file on disk so we can random-access the ZIP
    // central directory without holding the whole archive in memory. Backups
    // can be tens of GB once they include all photos.
    const tmpPath = pathJoin(tmpdir(), `packman-backup-${Date.now()}-${randomBytes(6).toString('hex')}.zip`)
    try {
      await pipeline(data.file, createWriteStream(tmpPath))
    } catch (err: any) {
      await fsp.unlink(tmpPath).catch(() => {})
      return reply.status(500).send({ message: t(request, 'admin.error.uploadFailed', { message: err?.message ?? t(request, 'admin.error.unknownError') }) })
    }

    try {
      // Magic-byte check on the spooled file (PK\x03\x04).
      const head = Buffer.alloc(4)
      const fh = await fsp.open(tmpPath, 'r')
      try { await fh.read(head, 0, 4, 0) } finally { await fh.close() }
      if (head[0] !== 0x50 || head[1] !== 0x4b) {
        return reply.status(400).send({ message: t(request, 'admin.error.invalidZip') })
      }

      let directory: Awaited<ReturnType<typeof unzipper.Open.file>>
      try {
        directory = await unzipper.Open.file(tmpPath)
      } catch {
        return reply.status(400).send({ message: t(request, 'admin.error.cannotReadZip') })
      }

      const dataFile = directory.files.find((f) => f.path === 'data.json' && f.type === 'File')
      if (!dataFile) return reply.status(400).send({ message: t(request, 'admin.error.missingDataJson') })

      let payload: any
      try {
        const dataBuf = await dataFile.buffer()
        payload = JSON.parse(dataBuf.toString('utf-8'))
      } catch {
        return reply.status(400).send({ message: t(request, 'admin.error.dataJsonFormat') })
      }

      if (!payload || typeof payload !== 'object') {
        return reply.status(400).send({ message: t(request, 'admin.error.dataJsonContent') })
      }
      if (typeof payload.version !== 'string' || !/^1\./.test(payload.version)) {
        return reply.status(400).send({ message: t(request, 'admin.error.unsupportedBackupVersion', { version: payload.version ?? t(request, 'admin.error.unknown') }) })
      }
      const requiredArrays = ['events', 'users', 'groups', 'boxes', 'items', 'batteries', 'selectOptions', 'batteryRegulations', 'systemSettings']
      for (const key of requiredArrays) {
        if (!Array.isArray(payload[key])) {
          return reply.status(400).send({ message: t(request, 'admin.error.dataJsonMissingField', { key }) })
        }
      }
      if (payload.events.length === 0) {
        return reply.status(400).send({ message: t(request, 'admin.error.backupNeedsEvent') })
      }

      const ALLOWED_PHOTO_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'])
      const photoEntries = directory.files.filter((f) => {
        if (f.type !== 'File') return false
        const name = f.path
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
              if (preserveSecrets && isSecretSettingKey(s.key)) continue
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
        return reply.status(500).send({ message: t(request, 'admin.error.restoreFailed', { message: err?.message ?? t(request, 'admin.error.unknownError') }) })
      }

      invalidate('groups:all')
      invalidate('selectOptions')

      let photoOk = 0
      let photoFail = 0
      // Stream each photo from the temp ZIP straight to MinIO. Sequential keeps
      // memory and connection counts bounded.
      for (const entry of photoEntries) {
        const objectName = entry.path.slice('photos/'.length)
        const ext = objectName.split('.').pop()?.toLowerCase()
        const contentType = ext === 'png' ? 'image/png'
          : ext === 'webp' ? 'image/webp'
          : ext === 'gif' ? 'image/gif'
          : ext === 'heic' ? 'image/heic'
          : ext === 'heif' ? 'image/heif'
          : 'image/jpeg'
        try {
          await uploadStreamToMinio(objectName, entry.stream(), entry.uncompressedSize, contentType)
          photoOk++
        } catch (err) {
          photoFail++
          request.log.warn({ err, objectName }, 'Restore: photo upload failed')
        }
      }

      return { ok: true, photoOk, photoFail }
    } finally {
      await fsp.unlink(tmpPath).catch(() => {})
    }
  })
}
