import type { User, Group, Box, BatteryRegulation, SelectOption } from '@packman/shared'

async function req<T>(url: string, options?: RequestInit): Promise<T> {
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
    throw new Error(err.message)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const adminApi = {
  login: async (username: string, password: string) => {
    const res = await fetch('/auth/admin-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error('帳號或密碼錯誤')
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
  createBox: (data: { label: string; shippingMethod: string; notes?: string }) =>
    req<Box>('/api/boxes', { method: 'POST', body: JSON.stringify(data) }),
  updateBox: (id: string, data: { label?: string; shippingMethod?: string; notes?: string; status?: string }) =>
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

  exportItems: () => window.open('/api/admin/export/items', '_blank'),
  exportBatteries: () => window.open('/api/admin/export/batteries', '_blank'),

  selectOptions: () => req<SelectOption[]>('/api/admin/select-options'),
  createSelectOption: (data: { type: string; value: string; label: string; sortOrder: number }) =>
    req<SelectOption>('/api/admin/select-options', { method: 'POST', body: JSON.stringify(data) }),
  updateSelectOption: (id: string, data: { label?: string; sortOrder?: number }) =>
    req<SelectOption>(`/api/admin/select-options/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSelectOption: (id: string) =>
    req<void>(`/api/admin/select-options/${id}`, { method: 'DELETE' }),
}
