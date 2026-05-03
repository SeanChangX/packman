import type {
  AdminAuthStatus,
  Event,
  User,
  Group,
  Box,
  BatteryRegulation,
  SelectOption,
  OllamaConfig,
  OllamaEndpoint,
  SystemSettings,
} from '@packman/shared'
import { getLocale, translate as t } from './i18n'

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

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options),
  })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function responseError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ message: fallback }))
  return err.message ?? fallback
}

export const adminApi = {
  adminStatus: async () => {
    const res = await fetch('/auth/admin-status', { credentials: 'include', headers: { 'Accept-Language': getLocale() } })
    if (!res.ok) throw new Error(t('api.error.adminStatus'))
    return res.json() as Promise<AdminAuthStatus>
  },
  setupAdmin: async (username: string, password: string) => {
    const res = await fetch('/auth/admin-setup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': getLocale() },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: t('api.error.setupFailed') }))
      throw new Error(err.message)
    }
  },
  login: async (username: string, password: string) => {
    const res = await fetch('/auth/admin-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': getLocale() },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: t('api.error.invalidCredentials') }))
      throw new Error(err.message ?? t('api.error.invalidCredentials'))
    }
  },
  logout: () =>
    req<void>('/auth/admin-logout', { method: 'POST' }),

  stats: () => req<{
    users: number; groups: number; boxes: number
    items: number; batteries: number; packedItems: number; sealedBoxes: number
  }>('/api/admin/stats'),

  users: () => req<User[]>('/api/admin/users'),
  updateUser: (id: string, data: { role?: string; groupId?: string | null }) =>
    req<User>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    req<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  groups: () => req<Group[]>('/api/groups'),
  createGroup: (data: { name: string; color: string }) =>
    req<Group>('/api/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateGroup: (id: string, data: { name?: string; color?: string }) =>
    req<Group>(`/api/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteGroup: (id: string) =>
    req<void>(`/api/groups/${id}`, { method: 'DELETE' }),

  boxes: () => req<Box[]>('/api/boxes'),
  createBox: (data: { label: string; shippingMethod: string; ownerId?: string; notes?: string }) =>
    req<Box>('/api/boxes', { method: 'POST', body: JSON.stringify(data) }),
  updateBox: (id: string, data: { label?: string; shippingMethod?: string; ownerId?: string | null; notes?: string; status?: string }) =>
    req<Box>(`/api/boxes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBox: (id: string) =>
    req<void>(`/api/boxes/${id}`, { method: 'DELETE' }),

  batteryRegulations: () => req<BatteryRegulation[]>('/api/battery-regulations'),
  createBatteryRegulation: (data: { title: string; content: string; sortOrder: number }) =>
    req<BatteryRegulation>('/api/battery-regulations', { method: 'POST', body: JSON.stringify(data) }),
  updateBatteryRegulation: (id: string, data: { title?: string; content?: string; sortOrder?: number }) =>
    req<BatteryRegulation>(`/api/battery-regulations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBatteryRegulation: (id: string) =>
    req<void>(`/api/battery-regulations/${id}`, { method: 'DELETE' }),

  events: () => req<Event[]>('/api/events'),
  createEvent: (data: { name: string }) =>
    req<Event>('/api/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id: string, data: { name: string }) =>
    req<Event>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  activateEvent: (id: string) =>
    req<{ activeEventId: string }>(`/api/events/${id}/activate`, { method: 'POST' }),
  deleteEvent: (id: string) =>
    req<void>(`/api/events/${id}`, { method: 'DELETE' }),

  exportItems: () => window.open('/api/admin/export/items', '_blank'),
  exportBatteries: () => window.open('/api/admin/export/batteries', '_blank'),
  exportBackup: () => window.open('/api/admin/export/backup', '_blank'),
  importBackup: (
    file: File,
    options?: { preserveSecrets?: boolean; onProgress?: (loaded: number, total: number) => void },
  ): Promise<{ ok: boolean; photoOk: number; photoFail: number }> => {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('file', file)
      const xhr = new XMLHttpRequest()
      const url = options?.preserveSecrets
        ? '/api/admin/import/backup?preserveSecrets=1'
        : '/api/admin/import/backup'
      xhr.open('POST', url, true)
      xhr.withCredentials = true
      xhr.setRequestHeader('Accept-Language', getLocale())
      const onProgress = options?.onProgress
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total)
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) }
          catch { reject(new Error(t('api.error.responseFormat'))) }
        } else {
          let message = t('api.error.backupRestore')
          try { message = JSON.parse(xhr.responseText)?.message ?? message } catch {}
          reject(new Error(message))
        }
      }
      xhr.onerror = () => reject(new Error(t('api.error.backupNetwork')))
      xhr.onabort = () => reject(new Error(t('api.error.backupAborted')))
      xhr.send(form)
    })
  },

  selectOptions: () => req<SelectOption[]>('/api/admin/select-options'),
  createSelectOption: (data: { type: string; label: string; sortOrder: number }) =>
    req<SelectOption>('/api/admin/select-options', { method: 'POST', body: JSON.stringify(data) }),
  updateSelectOption: (id: string, data: { label?: string; sortOrder?: number }) =>
    req<SelectOption>(`/api/admin/select-options/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSelectOption: (id: string) =>
    req<void>(`/api/admin/select-options/${id}`, { method: 'DELETE' }),

  ollamaConfig: () => req<OllamaConfig>('/api/admin/ollama-config'),
  updateOllamaConfig: (data: { enabled?: boolean; activeModel?: string; generateTimeoutMs?: number; healthTimeoutMs?: number; tagPrompt?: string; weightPrompt?: string }) =>
    req<OllamaConfig>('/api/admin/ollama-config', { method: 'PATCH', body: JSON.stringify(data) }),
  createOllamaEndpoint: (data: { baseUrl: string; enabled?: boolean }) =>
    req<OllamaEndpoint>('/api/admin/ollama-endpoints', { method: 'POST', body: JSON.stringify(data) }),
  updateOllamaEndpoint: (id: string, data: { baseUrl?: string; enabled?: boolean }) =>
    req<OllamaEndpoint>(`/api/admin/ollama-endpoints/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOllamaEndpoint: (id: string) =>
    req<void>(`/api/admin/ollama-endpoints/${id}`, { method: 'DELETE' }),

  settings: () => req<SystemSettings>('/api/admin/settings'),
  updateAppSettings: (data: { appUrl: string; adminUrl: string }) =>
    req<SystemSettings['app']>('/api/admin/settings/app', { method: 'PATCH', body: JSON.stringify(data) }),
  updateSlackSettings: (data: { clientId: string; clientSecret?: string; workspaceId: string }) =>
    req<SystemSettings['slack']>('/api/admin/settings/slack', { method: 'PATCH', body: JSON.stringify(data) }),
  updateAdminAccount: (data: { username: string; password?: string }) =>
    req<AdminAuthStatus>('/api/admin/settings/admin-account', { method: 'PATCH', body: JSON.stringify(data) }),
  updateBrandName: (name: string) =>
    req<SystemSettings['brand']>('/api/admin/settings/brand', { method: 'PATCH', body: JSON.stringify({ name }) }),
  uploadBrandLogo: async (file: File): Promise<SystemSettings['brand']> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/admin/settings/brand/logo', { method: 'POST', credentials: 'include', headers: { 'Accept-Language': getLocale() }, body: form })
    if (!res.ok) throw new Error(await responseError(res, t('api.error.logoUpload')))
    return res.json()
  },
  deleteBrandLogo: () => req<void>('/api/admin/settings/brand/logo', { method: 'DELETE' }),
}
