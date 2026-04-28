import axios from 'axios'
import sharp from 'sharp'
import { prisma } from '../plugins/prisma'

const MODEL_SETTING_KEY = 'ollama.visionModel'
const GENERATE_TIMEOUT_SETTING_KEY = 'ollama.generateTimeoutMs'
const HEALTH_TIMEOUT_SETTING_KEY = 'ollama.healthTimeoutMs'
const TAG_PROMPT_SETTING_KEY = 'ollama.tagPrompt'
const DEFAULT_MODEL = process.env.OLLAMA_VISION_MODEL ?? 'llava'
const DEFAULT_GENERATE_TIMEOUT_MS = 60_000
const DEFAULT_HEALTH_TIMEOUT_MS = 5_000

export const DEFAULT_TAG_PROMPT = [
  'Create search tags for the main visible object.',
  'Output one comma-separated line only.',
  'Use 4-10 lowercase English tags.',
  'Prefer short visual keywords: object type, color, material, shape, size, connector/port, marking, count, use.',
  'Use generic terms. Include brand/model text only if clearly readable.',
  'No sentences. No numbering. No JSON. No duplicates. No uncertain guesses.',
  'Example: hex key, blue, metal, l-shaped, tool, metric, compact',
].join(' ')

const modelCache = new Map<string, { models: string[]; expiresAt: number }>()

type EndpointCandidate = {
  id: string
  baseUrl: string
  enabled: boolean
  avgLatencyMs: number | null
  requestCount: number
  failureCount: number
  healthAvgLatencyMs?: number | null
  healthCheckCount?: number
  healthFailureCount?: number
}

export type OllamaAnalysisResult = {
  tags: string[]
  raw: string
  model: string
  endpoint: string
  latencyMs: number
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

function envBaseUrls() {
  return (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434')
    .split(',')
    .map(normalizeBaseUrl)
    .filter(Boolean)
}

async function prepareImage(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return resized.toString('base64')
}

export async function getActiveOllamaModel(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: MODEL_SETTING_KEY } })
  return setting?.value ?? DEFAULT_MODEL
}

async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } })
  const value = setting ? Number(setting.value) : NaN
  return Number.isFinite(value) ? value : fallback
}

export async function getOllamaTimeouts() {
  const [generateTimeoutMs, healthTimeoutMs] = await Promise.all([
    getNumberSetting(GENERATE_TIMEOUT_SETTING_KEY, DEFAULT_GENERATE_TIMEOUT_MS),
    getNumberSetting(HEALTH_TIMEOUT_SETTING_KEY, DEFAULT_HEALTH_TIMEOUT_MS),
  ])
  return { generateTimeoutMs, healthTimeoutMs }
}

export async function getTagPrompt(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: TAG_PROMPT_SETTING_KEY } })
  return setting?.value || DEFAULT_TAG_PROMPT
}

async function setSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

export async function updateOllamaConfig({
  activeModel,
  generateTimeoutMs,
  healthTimeoutMs,
  tagPrompt,
}: {
  activeModel?: string
  generateTimeoutMs?: number
  healthTimeoutMs?: number
  tagPrompt?: string
}) {
  await Promise.all([
    activeModel ? setSetting(MODEL_SETTING_KEY, activeModel.trim()) : Promise.resolve(),
    generateTimeoutMs !== undefined ? setSetting(GENERATE_TIMEOUT_SETTING_KEY, String(generateTimeoutMs)) : Promise.resolve(),
    healthTimeoutMs !== undefined ? setSetting(HEALTH_TIMEOUT_SETTING_KEY, String(healthTimeoutMs)) : Promise.resolve(),
    tagPrompt !== undefined ? setSetting(TAG_PROMPT_SETTING_KEY, tagPrompt.trim() || DEFAULT_TAG_PROMPT) : Promise.resolve(),
  ])
}

export async function ensureOllamaDefaults() {
  const endpointCount = await prisma.ollamaEndpoint.count()
  if (endpointCount === 0) {
    for (const baseUrl of envBaseUrls()) {
      await prisma.ollamaEndpoint.upsert({
        where: { baseUrl },
        update: {},
        create: { baseUrl },
      })
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: MODEL_SETTING_KEY },
    update: {},
    create: { key: MODEL_SETTING_KEY, value: DEFAULT_MODEL },
  })
  await prisma.systemSetting.upsert({
    where: { key: GENERATE_TIMEOUT_SETTING_KEY },
    update: {},
    create: { key: GENERATE_TIMEOUT_SETTING_KEY, value: String(DEFAULT_GENERATE_TIMEOUT_MS) },
  })
  await prisma.systemSetting.upsert({
    where: { key: HEALTH_TIMEOUT_SETTING_KEY },
    update: {},
    create: { key: HEALTH_TIMEOUT_SETTING_KEY, value: String(DEFAULT_HEALTH_TIMEOUT_MS) },
  })
  await prisma.systemSetting.upsert({
    where: { key: TAG_PROMPT_SETTING_KEY },
    update: {},
    create: { key: TAG_PROMPT_SETTING_KEY, value: DEFAULT_TAG_PROMPT },
  })
}

async function getEnabledEndpoints(): Promise<EndpointCandidate[]> {
  const endpoints = await prisma.ollamaEndpoint.findMany({
    where: { enabled: true },
    orderBy: { createdAt: 'asc' },
  })

  if (endpoints.length > 0) return endpoints

  return envBaseUrls().map((baseUrl, index) => ({
    id: `env-${index}`,
    baseUrl,
    enabled: true,
    avgLatencyMs: null,
    requestCount: 0,
    failureCount: 0,
  }))
}

function endpointScore(endpoint: EndpointCandidate) {
  const latency = endpoint.avgLatencyMs ?? 3000
  const failureRate = endpoint.requestCount > 0 ? endpoint.failureCount / endpoint.requestCount : 0
  const reliability = Math.max(0.05, 1 - failureRate)
  return reliability / Math.max(300, latency)
}

async function fetchEndpointModels(baseUrl: string, timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS): Promise<string[]> {
  const normalized = normalizeBaseUrl(baseUrl)
  const cached = modelCache.get(normalized)
  if (cached && cached.expiresAt > Date.now()) return cached.models

  const res = await axios.get<{ models: { name: string }[] }>(
    `${normalized}/api/tags`,
    { timeout: timeoutMs }
  )
  const models = res.data.models?.map((model) => model.name) ?? []
  modelCache.set(normalized, { models, expiresAt: Date.now() + 60_000 })
  return models
}

async function endpointsWithModel(endpoints: EndpointCandidate[], model: string, timeoutMs: number) {
  const checks = await Promise.allSettled(
    endpoints.map(async (endpoint) => ({
      endpoint,
      models: await fetchEndpointModels(endpoint.baseUrl, timeoutMs),
    }))
  )

  return checks
    .filter((check): check is PromiseFulfilledResult<{ endpoint: EndpointCandidate; models: string[] }> =>
      check.status === 'fulfilled'
    )
    .map((check) => check.value)
    .filter(({ models }) => models.includes(model))
    .map(({ endpoint }) => endpoint)
}

async function recordGenerateResult(endpoint: EndpointCandidate, latencyMs: number, error?: unknown) {
  if (endpoint.id.startsWith('env-')) return

  const isFailure = Boolean(error)
  const currentAvg = endpoint.avgLatencyMs ?? latencyMs
  const avgLatencyMs = Math.round(currentAvg * 0.75 + latencyMs * 0.25)
  const message = error instanceof Error ? error.message : error ? String(error) : null

  await prisma.ollamaEndpoint.update({
    where: { id: endpoint.id },
    data: {
      avgLatencyMs,
      lastLatencyMs: latencyMs,
      requestCount: { increment: 1 },
      ...(isFailure
        ? {
            failureCount: { increment: 1 },
            lastErrorAt: new Date(),
            lastError: message?.slice(0, 500) ?? 'Request failed',
          }
        : {
            lastSuccessAt: new Date(),
            lastError: null,
          }),
    },
  })
}

async function recordHealthResult(endpoint: EndpointCandidate, latencyMs: number, error?: unknown) {
  if (endpoint.id.startsWith('env-')) {
    return {
      healthAvgLatencyMs: latencyMs,
      healthLastLatencyMs: latencyMs,
      healthCheckCount: 1,
      healthFailureCount: error ? 1 : 0,
      healthLastSuccessAt: error ? null : new Date(),
      healthLastErrorAt: error ? new Date() : null,
      healthLastError: error instanceof Error ? error.message : error ? String(error) : null,
    }
  }

  const isFailure = Boolean(error)
  const currentAvg = 'healthAvgLatencyMs' in endpoint && typeof endpoint.healthAvgLatencyMs === 'number'
    ? endpoint.healthAvgLatencyMs
    : latencyMs
  const healthAvgLatencyMs = Math.round(currentAvg * 0.75 + latencyMs * 0.25)
  const message = error instanceof Error ? error.message : error ? String(error) : null

  await prisma.ollamaEndpoint.update({
    where: { id: endpoint.id },
    data: {
      healthAvgLatencyMs,
      healthLastLatencyMs: latencyMs,
      healthCheckCount: { increment: 1 },
      ...(isFailure
        ? {
            healthFailureCount: { increment: 1 },
            healthLastErrorAt: new Date(),
            healthLastError: message?.slice(0, 500) ?? 'Health check failed',
          }
        : {
            healthLastSuccessAt: new Date(),
            healthLastError: null,
          }),
    },
  })

  return {
    healthAvgLatencyMs,
    healthLastLatencyMs: latencyMs,
    healthCheckCount: (endpoint.healthCheckCount ?? 0) + 1,
    healthFailureCount: (endpoint.healthFailureCount ?? 0) + (isFailure ? 1 : 0),
    healthLastSuccessAt: isFailure ? null : new Date(),
    healthLastErrorAt: isFailure ? new Date() : null,
    healthLastError: isFailure ? message?.slice(0, 500) ?? 'Health check failed' : null,
  }
}

function parseEnglishTags(rawText: string): string[] {
  const tags = rawText
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/[,，、;\n]/)
    .map((tag) =>
      tag
        .replace(/^[\s\-*"'`[\](){}0-9.]+/, '')
        .replace(/["'`[\](){}]+$/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((tag) => tag.length > 0 && tag.length <= 30 && /[a-z]/.test(tag))

  return [...new Set(tags)].slice(0, 10)
}

function orderedEndpoints(endpoints: EndpointCandidate[]) {
  return [...endpoints].sort((a, b) => {
    const scoreA = endpointScore(a) * (0.9 + Math.random() * 0.2)
    const scoreB = endpointScore(b) * (0.9 + Math.random() * 0.2)
    return scoreB - scoreA
  })
}

export async function analyzeImageWithOllama(imageBuffer: Buffer): Promise<OllamaAnalysisResult> {
  const [base64Image, model, endpoints, timeouts, tagPrompt] = await Promise.all([
    prepareImage(imageBuffer),
    getActiveOllamaModel(),
    getEnabledEndpoints(),
    getOllamaTimeouts(),
    getTagPrompt(),
  ])

  if (endpoints.length === 0) {
    throw new Error('沒有可用的 Ollama endpoint')
  }

  const compatibleEndpoints = await endpointsWithModel(endpoints, model, timeouts.healthTimeoutMs)
  if (compatibleEndpoints.length === 0) {
    throw new Error(`沒有可用且已下載 ${model} 的 Ollama endpoint`)
  }

  let lastError: unknown
  for (const endpoint of orderedEndpoints(compatibleEndpoints)) {
    const startedAt = Date.now()
    try {
      const response = await axios.post<{ response: string }>(
        `${normalizeBaseUrl(endpoint.baseUrl)}/api/generate`,
        { model, prompt: tagPrompt, images: [base64Image], stream: false },
        { timeout: timeouts.generateTimeoutMs }
      )

      const latencyMs = Date.now() - startedAt
      await recordGenerateResult(endpoint, latencyMs)
      const raw = response.data.response.trim()
      return {
        tags: parseEnglishTags(raw),
        raw,
        model,
        endpoint: endpoint.baseUrl,
        latencyMs,
      }
    } catch (error) {
      const latencyMs = Date.now() - startedAt
      await recordGenerateResult(endpoint, latencyMs, error)
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Ollama 請求失敗')
}

export async function listOllamaModelStatus() {
  await ensureOllamaDefaults()
  const [activeModel, endpoints, timeouts, tagPrompt] = await Promise.all([
    getActiveOllamaModel(),
    prisma.ollamaEndpoint.findMany({ orderBy: { createdAt: 'asc' } }),
    getOllamaTimeouts(),
    getTagPrompt(),
  ])

  const statuses = await Promise.all(
    endpoints.map(async (endpoint) => {
      const startedAt = Date.now()
      try {
        const res = await axios.get<{ models: { name: string }[] }>(
          `${normalizeBaseUrl(endpoint.baseUrl)}/api/tags`,
          { timeout: timeouts.healthTimeoutMs }
        )
        const models = res.data.models?.map((model) => model.name) ?? []
        modelCache.set(normalizeBaseUrl(endpoint.baseUrl), { models, expiresAt: Date.now() + 60_000 })
        const healthMetrics = await recordHealthResult(endpoint, Date.now() - startedAt)
        return {
          ...endpoint,
          ...healthMetrics,
          ok: true,
          models,
        }
      } catch (error) {
        const healthMetrics = await recordHealthResult(endpoint, Date.now() - startedAt, error)
        return {
          ...endpoint,
          ...healthMetrics,
          ok: false,
          models: [],
          message: error instanceof Error ? error.message : 'Ollama 無法連線',
        }
      }
    })
  )

  const models = [...new Set(statuses.flatMap((endpoint) => endpoint.models))].sort()
  return { activeModel, ...timeouts, tagPrompt, defaultTagPrompt: DEFAULT_TAG_PROMPT, models, endpoints: statuses }
}
