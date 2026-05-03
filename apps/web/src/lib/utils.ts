import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PackingStatus, ShippingMethod, SelectOption } from '@packman/shared'

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
