import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { prisma } from '../plugins/prisma'
import { getObjectBuffer } from './minio'
import { analyzeImageWithOllama } from './ollama'

const WORKER_ID = `ai-tag-${process.pid}-${randomUUID()}`
const POLL_INTERVAL_MS = 2000
const LOCK_TIMEOUT_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = Math.max(1, parseInt(process.env.AI_TAG_MAX_ATTEMPTS ?? '3', 10))

type ClaimedJob = {
  id: string
  itemId: string
  objectName: string
  attempts: number
  maxAttempts: number
}

function retryDelayMs(attempts: number) {
  return Math.min(15 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempts - 1))
}

async function concurrencyLimit() {
  const enabledEndpoints = await prisma.ollamaEndpoint.count({ where: { enabled: true } })
  return Math.max(1, enabledEndpoints)
}

async function cancelOpenJobs(itemId: string) {
  await prisma.aiTagJob.updateMany({
    where: {
      itemId,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    data: {
      status: 'CANCELLED',
      lockedAt: null,
      lockedBy: null,
      lastError: 'Superseded by a newer photo upload',
    },
  })
}

export async function enqueueAiTagJob(itemId: string, objectName: string) {
  await cancelOpenJobs(itemId)
  return prisma.aiTagJob.create({
    data: {
      itemId,
      objectName,
      maxAttempts: MAX_ATTEMPTS,
    },
  })
}

async function reclaimStaleJobs() {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS)
  await prisma.aiTagJob.updateMany({
    where: {
      status: 'RUNNING',
      lockedAt: { lt: staleBefore },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: 'QUEUED',
      lockedAt: null,
      lockedBy: null,
      nextRunAt: new Date(),
      lastError: 'Worker lock expired',
    },
  })

  await prisma.aiTagJob.updateMany({
    where: {
      status: 'RUNNING',
      lockedAt: { lt: staleBefore },
      attempts: { gte: MAX_ATTEMPTS },
    },
    data: {
      status: 'FAILED',
      lockedAt: null,
      lockedBy: null,
      lastError: 'Worker lock expired after max attempts',
    },
  })
}

async function syncFailedItems() {
  await prisma.item.updateMany({
    where: {
      aiTagStatus: 'PENDING',
      aiTagJobs: {
        some: { status: 'FAILED' },
        none: { status: { in: ['QUEUED', 'RUNNING'] } },
      },
    },
    data: { aiTagStatus: 'FAILED' },
  })
}

async function claimNextJob(): Promise<ClaimedJob | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "AiTagJob"
      WHERE "status" = 'QUEUED'::"AiTagJobStatus"
        AND "nextRunAt" <= NOW()
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `

    const id = rows[0]?.id
    if (!id) return null

    return tx.aiTagJob.update({
      where: { id },
      data: {
        status: 'RUNNING',
        attempts: { increment: 1 },
        lockedAt: new Date(),
        lockedBy: WORKER_ID,
      },
      select: {
        id: true,
        itemId: true,
        objectName: true,
        attempts: true,
        maxAttempts: true,
      },
    })
  })
}

async function completeJob(job: ClaimedJob, tags: string[]) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.aiTagJob.updateMany({
      where: { id: job.id, status: 'RUNNING', lockedBy: WORKER_ID },
      data: {
        status: 'DONE',
        lockedAt: null,
        lockedBy: null,
        completedAt: new Date(),
        lastError: null,
      },
    })
    if (updated.count === 0) return

    await tx.item.update({
      where: { id: job.itemId },
      data: { tags, aiTagStatus: 'DONE' },
    })
  })
}

async function failJob(job: ClaimedJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const shouldRetry = job.attempts < job.maxAttempts
  await prisma.$transaction(async (tx) => {
    const updated = await tx.aiTagJob.updateMany({
      where: { id: job.id, status: 'RUNNING', lockedBy: WORKER_ID },
      data: shouldRetry
        ? {
            status: 'QUEUED',
            lockedAt: null,
            lockedBy: null,
            nextRunAt: new Date(Date.now() + retryDelayMs(job.attempts)),
            lastError: message.slice(0, 1000),
          }
        : {
            status: 'FAILED',
            lockedAt: null,
            lockedBy: null,
            lastError: message.slice(0, 1000),
          },
    })
    if (updated.count === 0 || shouldRetry) return

    await tx.item.update({
      where: { id: job.itemId },
      data: { aiTagStatus: 'FAILED' },
    })
  })
}

async function processJob(job: ClaimedJob, app: FastifyInstance) {
  try {
    const imageBuffer = await getObjectBuffer(job.objectName)
    const result = await analyzeImageWithOllama(imageBuffer)
    await completeJob(job, result.tags)
  } catch (error) {
    app.log.error({ err: error, jobId: job.id, itemId: job.itemId }, 'AI tag job failed')
    await failJob(job, error)
  }
}

export function startAiTagQueueWorker(app: FastifyInstance) {
  let active = 0
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      await reclaimStaleJobs()
      await syncFailedItems()
      const limit = await concurrencyLimit()
      while (active < limit) {
        const job = await claimNextJob()
        if (!job) break
        active += 1
        void processJob(job, app).finally(() => {
          active -= 1
          void tick()
        })
      }
    } catch (error) {
      app.log.error({ err: error }, 'AI tag queue tick failed')
    }
  }

  const interval = setInterval(() => void tick(), POLL_INTERVAL_MS)
  void tick()

  app.addHook('onClose', async () => {
    stopped = true
    clearInterval(interval)
  })
}
