import type { FastifyRequest } from 'fastify'

export const SUPPORTED_LOCALES = ['en', 'zh-Hant'] as const
export type ApiLocale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: ApiLocale = 'en'
export const LOCALE_COOKIE = 'packman-locale'

const en: Record<string, string> = {
  // auth
  'auth.error.tooManyAttempts': 'Too many failed sign-in attempts. Please try again later.',
  'auth.error.invalidCredentials': 'Invalid username or password',
  'auth.error.adminStatusFailed': 'Failed to fetch admin status',
  'auth.error.setupFailed': 'Setup failed',

  // events
  'events.error.deleteActive': 'Cannot delete the Event currently in use',
  'events.error.hasData': 'This Event still has {count} record(s); please clear them before deleting',
  'events.error.noActiveSetting': 'No active Event is configured. Please create one in the admin panel.',

  // admin / brand / options
  'admin.error.uploadImage': 'Please upload an image',
  'admin.error.unsupportedImage': 'Only PNG, JPG, WebP, and SVG are supported',
  'admin.error.duplicateOptionValue': 'A field option with the same value already exists',
  'admin.error.ollamaUnreachable': 'Ollama is unreachable',
  'admin.error.ollamaRequestFailed': 'Ollama request failed',
  'admin.error.uploadBackup': 'Please upload a backup file',
  'admin.error.uploadZip': 'Please upload a .zip backup file',
  'admin.error.uploadFailed': 'Upload failed: {message}',
  'admin.error.invalidZip': 'File is not a valid ZIP',
  'admin.error.cannotReadZip': 'Cannot read the ZIP file',
  'admin.error.missingDataJson': 'Backup is missing data.json',
  'admin.error.dataJsonFormat': 'data.json has invalid format',
  'admin.error.dataJsonContent': 'data.json content is invalid',
  'admin.error.unsupportedBackupVersion': 'Unsupported backup version: {version} (requires 1.x)',
  'admin.error.dataJsonMissingField': 'data.json is missing or has malformed field: {key}',
  'admin.error.backupNeedsEvent': 'Backup must include at least one Event',
  'admin.error.restoreFailed': 'Data restore failed: {message}',
  'admin.error.unknown': 'unknown',
  'admin.error.unknownError': 'unknown error',
  'admin.error.logoUploadFailed': 'Logo upload failed',

  // items
  'items.error.noPhotoForAnalysis': 'This item has no photo available for analysis',
  'items.error.aiDisabled': 'AI recognition is currently disabled',

  // upload (xhr)
  'upload.error.responseFormat': 'Invalid response format',
  'upload.error.aborted': 'Upload was canceled',
  'upload.error.network': '{action} failed (network error)',
  'upload.error.failed': '{action} failed',

  // ollama service
  'ollama.error.noEndpoint': 'No Ollama endpoint available',
  'ollama.error.noEndpointWithModel': 'No Ollama endpoint available with model {model} downloaded',
  'ollama.error.requestFailed': 'Ollama request failed',
  'ollama.error.unreachable': 'Ollama is unreachable',

  // pdf labels
  'pdf.label.owner': 'Owner',

  // password validation
  'password.error.usernameTooShort': 'Username must be at least 3 characters',
  'password.error.passwordTooShort': 'Password must be at least 12 characters',
  'password.error.passwordTooLong': 'Password cannot exceed 128 characters',
  'password.error.containsUsername': 'Password cannot contain the username',
  'password.error.notEnoughClasses': 'Password must include at least 3 of: uppercase, lowercase, digit, symbol',
  'password.error.weakWord': 'Password cannot contain common weak passwords',

  // server / prisma / zod
  'server.error.invalidInput': 'Please ensure all required fields are filled in correctly',
  'server.error.duplicateBoxLabel': 'Box label already exists',
  'server.error.duplicateName': 'Name already exists',
  'server.error.duplicateBatteryId': 'Battery ID already exists',
  'server.error.duplicateOllamaUrl': 'Ollama URL already exists',
  'server.error.duplicateGeneric': 'Record already exists',
  'server.error.internal': 'Server error',
}

const zhHant: Record<string, string> = {
  'auth.error.tooManyAttempts': '登入失敗次數過多，請稍後再試',
  'auth.error.invalidCredentials': '帳號或密碼錯誤',
  'auth.error.adminStatusFailed': '無法取得管理員狀態',
  'auth.error.setupFailed': '建立失敗',

  'events.error.deleteActive': '無法刪除正在使用中的 Event',
  'events.error.hasData': '此 Event 尚有 {count} 筆資料，請先清空後再刪除',
  'events.error.noActiveSetting': '尚未設定使用中的 Event，請至管理介面建立並啟用一個 Event',

  'admin.error.uploadImage': '請上傳圖片',
  'admin.error.unsupportedImage': '僅支援 PNG、JPG、WebP、SVG',
  'admin.error.duplicateOptionValue': '該類型中已有相同 value',
  'admin.error.ollamaUnreachable': 'Ollama 無法連線',
  'admin.error.ollamaRequestFailed': 'Ollama 請求失敗',
  'admin.error.uploadBackup': '請上傳備份檔',
  'admin.error.uploadZip': '請上傳 .zip 備份檔',
  'admin.error.uploadFailed': '上傳失敗：{message}',
  'admin.error.invalidZip': '檔案不是有效的 ZIP 格式',
  'admin.error.cannotReadZip': '無法讀取 ZIP 檔',
  'admin.error.missingDataJson': '備份檔缺少 data.json',
  'admin.error.dataJsonFormat': 'data.json 格式錯誤',
  'admin.error.dataJsonContent': 'data.json 內容無效',
  'admin.error.unsupportedBackupVersion': '不支援的備份版本：{version}（需 1.x）',
  'admin.error.dataJsonMissingField': 'data.json 缺少欄位或格式錯誤：{key}',
  'admin.error.backupNeedsEvent': '備份至少需包含一個 Event',
  'admin.error.restoreFailed': '資料還原失敗：{message}',
  'admin.error.unknown': '未知',
  'admin.error.unknownError': '未知錯誤',
  'admin.error.logoUploadFailed': 'Logo 上傳失敗',

  'items.error.noPhotoForAnalysis': '此物品尚無可辨識的照片',
  'items.error.aiDisabled': 'AI 辨識目前已停用',

  'upload.error.responseFormat': '回應格式錯誤',
  'upload.error.aborted': '上傳已取消',
  'upload.error.network': '{action}（網路錯誤）',
  'upload.error.failed': '{action}',

  'ollama.error.noEndpoint': '沒有可用的 Ollama endpoint',
  'ollama.error.noEndpointWithModel': '沒有可用且已下載 {model} 的 Ollama endpoint',
  'ollama.error.requestFailed': 'Ollama 請求失敗',
  'ollama.error.unreachable': 'Ollama 無法連線',

  'pdf.label.owner': '負責人',

  'password.error.usernameTooShort': '帳號至少需要 3 個字元',
  'password.error.passwordTooShort': '密碼至少需要 12 個字元',
  'password.error.passwordTooLong': '密碼不可超過 128 個字元',
  'password.error.containsUsername': '密碼不可包含帳號',
  'password.error.notEnoughClasses': '密碼需包含大小寫字母、數字、符號其中至少 3 類',
  'password.error.weakWord': '密碼不可包含常見弱密碼字詞',

  'server.error.invalidInput': '請確認所有必填欄位已正確填寫',
  'server.error.duplicateBoxLabel': '箱子編號已存在',
  'server.error.duplicateName': '名稱已存在',
  'server.error.duplicateBatteryId': '電池編號已存在',
  'server.error.duplicateOllamaUrl': 'Ollama URL 已存在',
  'server.error.duplicateGeneric': '資料已存在，請勿重複建立',
  'server.error.internal': '伺服器發生錯誤',
}

const messages: Record<ApiLocale, Record<string, string>> = { en, 'zh-Hant': zhHant }

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key]
    return v === undefined || v === null ? `{${key}}` : String(v)
  })
}

const matchSupported = (raw: string | undefined): ApiLocale | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  const direct = SUPPORTED_LOCALES.find((s) => s.toLowerCase() === trimmed.toLowerCase())
  if (direct) return direct
  const region = trimmed.split('-')[0].toLowerCase()
  const partial = SUPPORTED_LOCALES.find((s) => s.split('-')[0].toLowerCase() === region)
  return partial ?? null
}

const parseAcceptLanguage = (header: string | undefined): ApiLocale | null => {
  if (!header) return null
  const tags = header.split(',').map((part) => {
    const [tag, ...params] = part.trim().split(';')
    const qParam = params.find((p) => p.trim().startsWith('q='))
    const q = qParam ? parseFloat(qParam.split('=')[1]) : 1
    return { tag: tag.trim(), q: isNaN(q) ? 1 : q }
  }).sort((a, b) => b.q - a.q)
  for (const { tag } of tags) {
    const match = matchSupported(tag)
    if (match) return match
  }
  return null
}

export const resolveLocale = (req: FastifyRequest): ApiLocale => {
  const cookieLocale = matchSupported((req as any).cookies?.[LOCALE_COOKIE])
  if (cookieLocale) return cookieLocale
  const headerLocale = parseAcceptLanguage(req.headers['accept-language'])
  if (headerLocale) return headerLocale
  return DEFAULT_LOCALE
}

export const t = (
  req: FastifyRequest,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const locale = resolveLocale(req)
  const dict = messages[locale] ?? messages[DEFAULT_LOCALE]
  const fallback = messages[DEFAULT_LOCALE]
  const raw = dict[key] ?? fallback[key] ?? key
  return interpolate(raw, params)
}

export const tFor = (locale: ApiLocale) => (key: string, params?: Record<string, string | number>): string => {
  const dict = messages[locale] ?? messages[DEFAULT_LOCALE]
  const fallback = messages[DEFAULT_LOCALE]
  const raw = dict[key] ?? fallback[key] ?? key
  return interpolate(raw, params)
}

export class LocalizedError extends Error {
  constructor(
    public readonly key: string,
    public readonly statusCode: number = 400,
    public readonly params?: Record<string, string | number>,
  ) {
    super(key)
    this.name = 'LocalizedError'
  }
}

export const isLocalizedError = (err: unknown): err is LocalizedError =>
  err instanceof LocalizedError

export class MultiKeyError extends Error {
  constructor(
    public readonly keys: string[],
    public readonly statusCode: number = 400,
    public readonly separator: string = '、',
  ) {
    super(keys.join(','))
    this.name = 'MultiKeyError'
  }
}

export const isMultiKeyError = (err: unknown): err is MultiKeyError =>
  err instanceof MultiKeyError
