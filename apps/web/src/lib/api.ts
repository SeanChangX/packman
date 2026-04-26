import type {
  User, Group, Box, Item, Battery,
  PaginatedResponse,
} from '@packman/shared'
import type {
  CreateGroupInput, UpdateGroupInput,
  CreateBoxInput, UpdateBoxInput,
  CreateItemInput, UpdateItemInput,
  CreateBatteryInput, UpdateBatteryInput,
  UpdateUserInput, StickerRequest,
} from '@packman/shared'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
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
  uploadPhoto: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/items/${id}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) throw new Error('Photo upload failed')
    return res.json() as Promise<{ photoUrl: string }>
  },
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

// ─── Stickers ──────────────────────────────────────────────────────
export const stickersApi = {
  downloadItems: async (data: StickerRequest) => {
    const res = await fetch(`${BASE}/stickers/items`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Sticker generation failed')
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Sticker generation failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'box-stickers.pdf'
    a.click()
    URL.revokeObjectURL(url)
  },
}
