import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { authPlugin } from './plugins/auth'
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
import { seedDefaultData } from './seed'

const PORT = parseInt(process.env.PORT ?? '8080', 10)
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001'

async function build() {
  const app = Fastify({ logger: { level: 'info' } })

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)

    if (error instanceof ZodError) {
      return reply.status(400).send({ message: '請確認所有必填欄位已正確填寫' })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : []
        if (target.includes('label')) {
          return reply.status(409).send({ message: '箱子編號已存在' })
        }
        if (target.includes('name')) {
          return reply.status(409).send({ message: '名稱已存在' })
        }
        if (target.includes('batteryId')) {
          return reply.status(409).send({ message: '電池編號已存在' })
        }
        return reply.status(409).send({ message: '資料已存在，請勿重複建立' })
      }
    }

    return reply.status(error.statusCode ?? 500).send({
      message: error.statusCode && error.statusCode < 500 ? error.message : '伺服器發生錯誤',
    })
  })

  await app.register(cors, {
    origin: [APP_URL, ADMIN_URL],
    credentials: true,
  })

  await app.register(cookie, {
    secret: process.env.JWT_SECRET ?? 'fallback-secret',
  })

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
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

  return app
}

build().then(async (app) => {
  // Seed default groups and boxes on startup. The seed uses upserts, so this is safe to rerun.
  await seedDefaultData()

  // Ensure MinIO bucket exists on startup
  try {
    await ensureBucket()
  } catch (err) {
    app.log.warn({ err }, 'MinIO bucket setup failed — photo uploads will not work')
  }

  app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
  })
})
