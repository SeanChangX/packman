import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'crypto'
import { prisma } from '../plugins/prisma'

function scrypt(password: string, salt: string, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

const SETTINGS = {
  appUrl: 'app.url',
  adminUrl: 'app.adminUrl',
  apiUrl: 'app.apiUrl',
  slackClientId: 'slack.clientId',
  slackClientSecret: 'slack.clientSecret',
  slackWorkspaceId: 'slack.workspaceId',
  slackRedirectUri: 'slack.redirectUri',
  adminUsername: 'admin.username',
  adminPasswordHash: 'admin.passwordHash',
  jwtSecret: 'security.jwtSecret',
  cookieSecret: 'security.cookieSecret',
  brandLogoObjectName: 'brand.logoObjectName',
  brandLogoData: 'brand.logoData',
  brandName: 'brand.name',
} as const

const DEFAULT_APP_URL = 'http://localhost:3000'
const DEFAULT_ADMIN_URL = 'http://localhost:3001'
const DEFAULT_API_URL = 'http://localhost:8080'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d'

let jwtSecret = ''
let cookieSecret = ''

async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } })
  return setting?.value ?? null
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

async function setOptionalSetting(key: string, value: string | undefined): Promise<void> {
  if (value === undefined) return
  await setSetting(key, value.trim())
}

async function ensureSecret(key: string): Promise<string> {
  const existing = await getSetting(key)
  if (existing) return existing

  const generated = randomBytes(48).toString('base64url')
  await setSetting(key, generated)
  return generated
}

export async function initRuntimeSecrets() {
  jwtSecret = await ensureSecret(SETTINGS.jwtSecret)
  cookieSecret = await ensureSecret(SETTINGS.cookieSecret)
  return { jwtSecret, cookieSecret }
}

export function getJwtSecret() {
  if (!jwtSecret) throw new Error('Runtime secrets have not been initialized')
  return jwtSecret
}

export function getJwtExpiresIn() {
  return JWT_EXPIRES_IN
}

export async function getAppConfig() {
  const [appUrl, adminUrl, apiUrl] = await Promise.all([
    getSetting(SETTINGS.appUrl),
    getSetting(SETTINGS.adminUrl),
    getSetting(SETTINGS.apiUrl),
  ])

  return {
    appUrl: appUrl || DEFAULT_APP_URL,
    adminUrl: adminUrl || DEFAULT_ADMIN_URL,
    apiUrl: apiUrl || DEFAULT_API_URL,
  }
}

export async function updateAppConfig(input: {
  appUrl?: string
  adminUrl?: string
  apiUrl?: string
}) {
  await Promise.all([
    setOptionalSetting(SETTINGS.appUrl, input.appUrl),
    setOptionalSetting(SETTINGS.adminUrl, input.adminUrl),
    setOptionalSetting(SETTINGS.apiUrl, input.apiUrl),
  ])
  return getAppConfig()
}

export async function getSlackConfig() {
  const [clientId, clientSecret, workspaceId, redirectUri] = await Promise.all([
    getSetting(SETTINGS.slackClientId),
    getSetting(SETTINGS.slackClientSecret),
    getSetting(SETTINGS.slackWorkspaceId),
    getSetting(SETTINGS.slackRedirectUri),
  ])

  return {
    clientId: clientId ?? '',
    clientSecret: clientSecret ?? '',
    clientSecretSet: Boolean(clientSecret),
    workspaceId: workspaceId ?? '',
    redirectUri: redirectUri ?? '',
  }
}

export async function updateSlackConfig(input: {
  clientId?: string
  clientSecret?: string
  workspaceId?: string
  redirectUri?: string
}) {
  await Promise.all([
    setOptionalSetting(SETTINGS.slackClientId, input.clientId),
    input.clientSecret ? setSetting(SETTINGS.slackClientSecret, input.clientSecret.trim()) : Promise.resolve(),
    setOptionalSetting(SETTINGS.slackWorkspaceId, input.workspaceId),
    setOptionalSetting(SETTINGS.slackRedirectUri, input.redirectUri),
  ])
  return getSlackConfig()
}

export async function getAdminAuthStatus() {
  const [username, passwordHash] = await Promise.all([
    getSetting(SETTINGS.adminUsername),
    getSetting(SETTINGS.adminPasswordHash),
  ])
  return {
    setupRequired: !username || !passwordHash,
    username: username ?? '',
  }
}

function passwordProblems(username: string, password: string): string[] {
  const problems: string[] = []
  if (username.trim().length < 3) problems.push('帳號至少需要 3 個字元')
  if (password.length < 12) problems.push('密碼至少需要 12 個字元')
  if (password.length > 128) problems.push('密碼不可超過 128 個字元')
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    problems.push('密碼不可包含帳號')
  }

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length
  if (classes < 3) problems.push('密碼需包含大小寫字母、數字、符號其中至少 3 類')

  const weak = ['password', 'admin', 'packman', 'changeme', 'qwerty', '123456']
  if (weak.some((word) => password.toLowerCase().includes(word))) {
    problems.push('密碼不可包含常見弱密碼字詞')
  }
  return problems
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const N = 16384
  const r = 8
  const p = 1
  const key = await scrypt(password, salt, 64, {
    cost: N,
    blockSize: r,
    parallelization: p,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${N}$${r}$${p}$${salt}$${key.toString('base64url')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, rawN, rawR, rawP, salt, expected] = stored.split('$')
  if (algorithm !== 'scrypt' || !rawN || !rawR || !rawP || !salt || !expected) return false

  const key = await scrypt(password, salt, 64, {
    cost: Number(rawN),
    blockSize: Number(rawR),
    parallelization: Number(rawP),
    maxmem: 64 * 1024 * 1024,
  })
  const expectedBuffer = Buffer.from(expected, 'base64url')
  return expectedBuffer.length === key.length && timingSafeEqual(expectedBuffer, key)
}

export async function createInitialAdminAccount(username: string, password: string) {
  const status = await getAdminAuthStatus()
  if (!status.setupRequired) {
    throw Object.assign(new Error('Admin account already exists'), { statusCode: 409 })
  }
  return updateAdminAccount({ username, password })
}

export async function updateAdminAccount(input: { username: string; password?: string }) {
  const username = input.username.trim()
  const password = input.password ?? ''
  const problems = input.password !== undefined ? passwordProblems(username, password) : (
    username.length < 3 ? ['帳號至少需要 3 個字元'] : []
  )
  if (problems.length > 0) {
    throw Object.assign(new Error(problems.join('、')), { statusCode: 400 })
  }

  await setSetting(SETTINGS.adminUsername, username)
  if (input.password !== undefined) {
    await setSetting(SETTINGS.adminPasswordHash, await hashPassword(password))
  }
  return getAdminAuthStatus()
}

export async function verifyAdminLogin(username: string, password: string) {
  const [storedUsername, storedHash] = await Promise.all([
    getSetting(SETTINGS.adminUsername),
    getSetting(SETTINGS.adminPasswordHash),
  ])
  if (!storedUsername || !storedHash) return false
  if (username !== storedUsername) return false
  return verifyPassword(password, storedHash)
}

export async function getBrandConfig() {
  const [logoObjectName, logoData, name] = await Promise.all([
    getSetting(SETTINGS.brandLogoObjectName),
    getSetting(SETTINGS.brandLogoData),
    getSetting(SETTINGS.brandName),
  ])
  return { logoObjectName: logoObjectName ?? null, logoData: logoData ?? null, name: name ?? '' }
}

export async function updateBrandName(name: string) {
  await setSetting(SETTINGS.brandName, name.trim())
  return getBrandConfig()
}

export async function setBrandLogoObjectName(objectName: string | null) {
  if (objectName === null) {
    await prisma.systemSetting.deleteMany({ where: { key: SETTINGS.brandLogoObjectName } })
  } else {
    await setSetting(SETTINGS.brandLogoObjectName, objectName)
  }
}

export async function setBrandLogoData(data: Buffer | null) {
  if (data === null) {
    await prisma.systemSetting.deleteMany({ where: { key: SETTINGS.brandLogoData } })
  } else {
    await setSetting(SETTINGS.brandLogoData, data.toString('base64'))
  }
}

export async function getBrandLogoBuffer() {
  const brand = await getBrandConfig()
  if (brand.logoData) return Buffer.from(brand.logoData, 'base64')
  return null
}
