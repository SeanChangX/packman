import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PackingStatus, ShippingMethod, UseCategory, BatteryType } from '@packman/shared'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<PackingStatus, string> = {
  NOT_PACKED: '尚未裝箱',
  PACKED: '已裝箱',
  SEALED: '已封箱',
}

export const STATUS_COLORS: Record<PackingStatus, string> = {
  NOT_PACKED: 'bg-red-100 text-red-800',
  PACKED: 'bg-yellow-100 text-yellow-800',
  SEALED: 'bg-green-100 text-green-800',
}

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  CHECKED: '託運',
  CARRY_ON: '登機',
}

export const USE_CATEGORY_LABELS: Record<UseCategory, string> = {
  HIGH_FREQ: '高使用頻率',
  RETURN_ONLY: '往返物品',
  ONE_WAY: '單程物品',
  LOW_FREQ: '低使用頻率',
}

export const BATTERY_TYPE_LABELS: Record<BatteryType, string> = {
  POWER_TOOL: '工具機電池',
  BEACON_CHARGER: 'Beacon行充',
  LIFEPO4: '磁酸鋰鐵電池',
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}
