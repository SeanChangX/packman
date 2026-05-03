import type {
  User, Group, Box, Item, Battery, BatteryRegulation, SelectOption,
  PaginatedResponse, Event,
} from '@packman/shared'
import type {
  CreateGroupInput, UpdateGroupInput,
  CreateBoxInput, UpdateBoxInput,
  CreateItemInput, UpdateItemInput,
  CreateBatteryInput, UpdateBatteryInput,
  UpdateUserInput, StickerRequest,
} from '@packman/shared'
import { getLocale, translate as t } from './i18n'

const BASE = '/api'

function buildHeaders(options?: RequestInit): Headers {
  const headers = new Headers(options?.headers)
  if (options?.body !== undefined && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', getLocale())
  }
  return headers
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options),
  })
  if (res.status === 401) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ message: fallback }))
  return err.message ?? fallback
}

// ─── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

// ─── Groups ────────────────────────────────────────────────────────
export const groupsApi = {
  list: () => request<Group[]>(`${BASE}/groups`),
  create: (data: CreateGroupInput) =>
    request<Group>(`${BASE}/groups`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateGroupInput) =>
    request<Group>(`${BASE}/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`${BASE}/groups/${id}`, { method: 'DELETE' }),
}

// ─── Users ─────────────────────────────────────────────────────────
export const usersApi = {
  list: () => request<User[]>(`${BASE}/users`),
  get: (id: string) => request<User>(`${BASE}/users/${id}`),
  update: (id: string, data: UpdateUserInput) =>
    request<User>(`${BASE}/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ─── Boxes ─────────────────────────────────────────────────────────
export const boxesApi = {
  list: (shippingMethod?: string) =>
    request<Box[]>(`${BASE}/boxes${shippingMethod ? `?shippingMethod=${shippingMethod}` : ''}`),
  get: (id: string) => request<Box>(`${BASE}/boxes/${id}`),
  create: (data: CreateBoxInput) =>
    request<Box>(`${BASE}/boxes`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateBoxInput) =>
    request<Box>(`${BASE}/boxes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`${BASE}/boxes/${id}`, { method: 'DELETE' }),
  qrUrl: (id: string) => `${BASE}/boxes/${id}/qr`,
  stickerUrl: (id: string, size = 'MEDIUM') =>
    `${BASE}/boxes/${id}/sticker?size=${size}`,
}

// ─── Items ─────────────────────────────────────────────────────────
interface ItemsQuery {
  groupId?: string
  boxId?: string
  status?: string
  shippingMethod?: string
  search?: string
  page?: number
  pageSize?: number
}

export const itemsApi = {
  stats: () => request<{ total: number; NOT_PACKED: number; PACKED: number; SEALED: number }>(`${BASE}/items/stats`),
  list: (q?: ItemsQuery) => {
    const params = new URLSearchParams()
    if (q?.groupId) params.set('groupId', q.groupId)
    if (q?.boxId) params.set('boxId', q.boxId)
    if (q?.status) params.set('status', q.status)
    if (q?.shippingMethod) params.set('shippingMethod', q.shippingMethod)
    if (q?.search) params.set('search', q.search)
    if (q?.page) params.set('page', String(q.page))
    if (q?.pageSize) params.set('pageSize', String(q.pageSize))
    const qs = params.toString()
    return request<PaginatedResponse<Item>>(`${BASE}/items${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => request<Item>(`${BASE}/items/${id}`),
  create: (data: CreateItemInput) =>
    request<Item>(`${BASE}/items`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateItemInput) =>
    request<Item>(`${BASE}/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`${BASE}/items/${id}`, { method: 'DELETE' }),
  batchDelete: (ids: string[]) =>
    request<void>(`${BASE}/items/batch-delete`, { method: 'POST', body: JSON.stringify({ ids }) }),
  uploadPhoto: (
    id: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<{ photoUrl: string }> => {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('file', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE}/items/${id}/photo`, true)
      xhr.withCredentials = true
      xhr.setRequestHeader('Accept-Language', getLocale())
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total)
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) }
          catch { reject(new Error(t('api.error.responseFormat'))) }
        } else if (xhr.status === 401) {
          if (window.location.pathname !== '/login') window.location.href = '/login'
          reject(new Error('Unauthorized'))
        } else {
          let message = t('api.error.photoUpload')
          try { message = JSON.parse(xhr.responseText)?.message ?? message } catch {}
          reject(new Error(message))
        }
      }
      xhr.onerror = () => reject(new Error(t('api.error.photoNetwork')))
      xhr.onabort = () => reject(new Error(t('api.error.photoAborted')))
      xhr.send(form)
    })
  },
  reanalyzePhoto: (id: string) =>
    request<{ ok: boolean }>(`${BASE}/items/${id}/retag`, { method: 'POST' }),
  photoUrl: (id: string) => `${BASE}/items/${id}/photo`,
  qrUrl: (id: string) => `${BASE}/items/${id}/qr`,
}

// ─── Batteries ─────────────────────────────────────────────────────
export const batteriesApi = {
  list: (batteryType?: string) =>
    request<Battery[]>(
      `${BASE}/batteries${batteryType ? `?batteryType=${batteryType}` : ''}`
    ),
  create: (data: CreateBatteryInput) =>
    request<Battery>(`${BASE}/batteries`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateBatteryInput) =>
    request<Battery>(`${BASE}/batteries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`${BASE}/batteries/${id}`, { method: 'DELETE' }),
}

export const batteryRegulationsApi = {
  list: () => request<BatteryRegulation[]>(`${BASE}/battery-regulations`),
}

// ─── Select Options ────────────────────────────────────────────────
export const selectOptionsApi = {
  list: (type?: string) =>
    request<SelectOption[]>(`${BASE}/options${type ? `?type=${type}` : ''}`),
}

// ─── Stickers ──────────────────────────────────────────────────────
export const stickersApi = {
  downloadItems: async (data: StickerRequest) => {
    const res = await fetch(`${BASE}/stickers/items`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': getLocale() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await errorMessage(res, t('api.error.stickerGenerate')))
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'item-stickers.pdf'
    a.click()
    URL.revokeObjectURL(url)
  },
  downloadBoxes: async (data: StickerRequest) => {
    const res = await fetch(`${BASE}/stickers/boxes`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': getLocale() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await errorMessage(res, t('api.error.stickerGenerate')))
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'box-stickers.pdf'
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const eventsApi = {
  active: () => request<Event | null>(`${BASE}/events/active`),
}
