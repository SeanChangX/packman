import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PackingStatus, ShippingMethod, SelectOption } from '@packman/shared'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<PackingStatus, string> = {
  NOT_PACKED: '尚未裝箱',
  PACKED: '已裝箱',
  SEALED: '已封箱',
}

export const STATUS_COLORS: Record<PackingStatus, string> = {
  NOT_PACKED: 'bg-red-500/10 text-brand-600 ring-1 ring-red-500/15',
  PACKED: 'bg-black/10 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-white dark:ring-white/10',
  SEALED: 'bg-black text-white ring-1 ring-black dark:bg-white dark:text-black dark:ring-white',
}

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  CHECKED: '託運',
  CARRY_ON: '登機',
}

export function optionsToSelectItems(options: SelectOption[]) {
  return options.map((o) => ({ value: o.value, label: o.label }))
}

export function getLabelFromOptions(options: SelectOption[] | undefined, value: string): string {
  return options?.find((o) => o.value === value)?.label ?? value
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}
