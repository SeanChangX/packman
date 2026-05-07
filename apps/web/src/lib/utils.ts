import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PackingStatus, ShippingMethod, SelectOption, User } from '@packman/shared'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABEL_KEYS: Record<PackingStatus, string> = {
  NOT_PACKED: 'status.NOT_PACKED',
  PACKED: 'status.PACKED',
  SEALED: 'status.SEALED',
}

export const STATUS_COLORS: Record<PackingStatus, string> = {
  NOT_PACKED: 'bg-red-500/10 text-brand-600 ring-1 ring-red-500/15',
  PACKED: 'bg-black/10 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-white dark:ring-white/10',
  SEALED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20',
}

export const SHIPPING_LABEL_KEYS: Record<ShippingMethod, string> = {
  CHECKED: 'shipping.CHECKED',
  CARRY_ON: 'shipping.CARRY_ON',
}

export function optionsToSelectItems(options: SelectOption[]) {
  return options.map((o) => ({ value: o.value, label: o.label }))
}

export function getLabelFromOptions(options: SelectOption[] | undefined, value: string): string {
  return options?.find((o) => o.value === value)?.label ?? value
}

export function formatDate(iso: string, locale: string = 'en-US') {
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

// ISO-style timestamp: "2026-05-04 15:42" — sv-SE happens to format dates in
// ISO 8601 shape, giving us zero-padded year/month/day and 24-hour time.
export function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

// Order owner-select candidates so the most likely picks come first:
//   1. The current user
//   2. Other members of the current user's group, by name
//   3. Everyone else, grouped by group name then by name
//   4. Users with no group, by name (last)
// Returning a new array — callers can still .map to whatever option shape they need.
export function sortUsersForOwnerSelect<T extends Pick<User, 'id' | 'name' | 'groupId' | 'group'>>(
  users: T[] | undefined,
  me: { id: string; groupId?: string | null } | null | undefined,
): T[] {
  if (!users) return []
  const meId = me?.id
  const myGroupId = me?.groupId
  return [...users].sort((a, b) => {
    if (a.id === meId) return -1
    if (b.id === meId) return 1
    const aMine = !!myGroupId && a.groupId === myGroupId
    const bMine = !!myGroupId && b.groupId === myGroupId
    if (aMine !== bMine) return aMine ? -1 : 1
    // Both in/out of my group: sort by group name (no group last), then name.
    const aGroup = a.group?.name ?? ''
    const bGroup = b.group?.name ?? ''
    if (aGroup !== bGroup) {
      if (!aGroup) return 1
      if (!bGroup) return -1
      return aGroup.localeCompare(bGroup)
    }
    return a.name.localeCompare(b.name)
  })
}

export function formatApiError(error: unknown, fallback = 'Operation failed', requiredHint = 'Please ensure all required fields are filled in correctly'): string {
  const msg = (error as Error)?.message ?? fallback
  try {
    const parsed = JSON.parse(msg)
    if (Array.isArray(parsed) && parsed[0]?.code) {
      return requiredHint
    }
  } catch {}
  return msg
}
