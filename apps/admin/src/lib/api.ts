import type { User, Group } from '@packman/shared'

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const adminApi = {
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

  exportItems: () => window.open('/api/admin/export/items', '_blank'),
  exportBatteries: () => window.open('/api/admin/export/batteries', '_blank'),
}
