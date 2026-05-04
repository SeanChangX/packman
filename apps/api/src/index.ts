import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { authPlugin } from './plugins/auth'
import { t, isLocalizedError, isMultiKeyError, resolveLocale, tFor } from './lib/i18n'
import { ensureBucket } from './services/minio'
import { authRoutes } from './routes/auth'
import { itemRoutes } from './routes/items'
import { boxRoutes } from './routes/boxes'
import { batteryRoutes } from './routes/batteries'
import { batteryRegulationRoutes } from './routes/battery-regulations'
import { groupRoutes } from './routes/groups'
import { userRoutes } from './routes/users'
import { stickerRoutes } from './routes/stickers'
import { optionRoutes } from './routes/options'
import { adminRoutes } from './routes/admin'
import { eventRoutes } from './routes/events'
import { seedDefaultData } from './seed'
import { startAiTagQueueWorker } from './services/ai-tag-queue'
import { getAppConfig, initRuntimeSecrets } from './services/runtime-config'

const PORT = parseInt(process.env.PORT ?? '8080', 10)

async function build() {
  const app = Fastify({ logger: { level: 'info' }, trustProxy: true })
  const secrets = await initRuntimeSecrets()

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)

    if (isLocalizedError(error)) {
      return reply.status(error.statusCode).send({ message: t(request, error.key, error.params) })
    }

    if (isMultiKeyError(error)) {
      const tr = tFor(resolveLocale(request))
      return reply.status(error.statusCode).send({
        message: error.keys.map((k) => tr(k)).join(error.separator),
      })
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({ message: t(request, 'server.error.invalidInput') })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : []
        if (target.includes('label')) {
          return reply.status(409).send({ message: t(request, 'server.error.duplicateBoxLabel') })
        }
        if (target.includes('name')) {
          return reply.status(409).send({ message: t(request, 'server.error.duplicateName') })
        }
        if (target.includes('batteryId')) {
          return reply.status(409).send({ message: t(request, 'server.error.duplicateBatteryId') })
        }
        if (target.includes('baseUrl')) {
          return reply.status(409).send({ message: t(request, 'server.error.duplicateOllamaUrl') })
        }
        return reply.status(409).send({ message: t(request, 'server.error.duplicateGeneric') })
      }
    }

    return reply.status(error.statusCode ?? 500).send({
      message: error.statusCode && error.statusCode < 500 ? error.message : t(request, 'server.error.internal'),
    })
  })

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      getAppConfig()
        .then(({ appUrl, adminUrl }) => callback(null, origin === appUrl || origin === adminUrl))
        .catch((err) => callback(err, false))
    },
    credentials: true,
  })

  await app.register(cookie, {
    secret: secrets.cookieSecret,
  })

  await app.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB (backup ZIPs may contain many photos)
  })

  await app.register(authPlugin)

  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(itemRoutes, { prefix: '/api/items' })
  await app.register(boxRoutes, { prefix: '/api/boxes' })
  await app.register(batteryRoutes, { prefix: '/api/batteries' })
  await app.register(batteryRegulationRoutes, { prefix: '/api/battery-regulations' })
  await app.register(groupRoutes, { prefix: '/api/groups' })
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.register(stickerRoutes, { prefix: '/api/stickers' })
  await app.register(optionRoutes, { prefix: '/api/options' })
  await app.register(adminRoutes, { prefix: '/api/admin' })
  await app.register(eventRoutes, { prefix: '/api/events' })

  return app
}

build().then(async (app) => {
  // Seed default groups and boxes on startup. The seed uses upserts, so this is safe to rerun.
  await seedDefaultData({
    info: (msg) => app.log.info(msg),
    error: (err, msg) => app.log.error({ err }, msg ?? 'Seed error'),
  })

  // Ensure MinIO bucket exists on startup
  try {
    await ensureBucket()
  } catch (err) {
    app.log.warn({ err }, 'MinIO bucket setup failed — photo uploads will not work')
  }

  startAiTagQueueWorker(app)

  app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
  })
})
