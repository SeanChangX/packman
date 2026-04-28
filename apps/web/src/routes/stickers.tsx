import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Printer, Package, Box } from 'lucide-react'
import { useToast } from '@packman/ui'
import { itemsApi, boxesApi, stickersApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, cn } from '../lib/utils'
import { Select } from '../lib/select'
import { useAuth } from '../lib/auth-context'
import type { PackingStatus } from '@packman/shared'

type StickerSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'A4_SHEET'

const SIZE_LABELS: Record<StickerSize, string> = {
  SMALL: '小 (50×30mm)',
  MEDIUM: '中 (100×50mm)',
  LARGE: '大 (150×100mm)',
  A4_SHEET: 'A4 (2×4 格)',
}

function StickersPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState<'items' | 'boxes'>('items')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [size, setSize] = useState<StickerSize>('MEDIUM')

  const { data: items } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemsApi.list({ pageSize: 200 }),
  })
  const { data: boxes } = useQuery({
    queryKey: ['boxes'],
    queryFn: () => boxesApi.list(),
  })

  const list = mode === 'items'
    ? (items?.data ?? [])
    : (boxes ?? [])

  const download = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds)
      if (mode === 'items') await stickersApi.downloadItems({ ids, size })
      else await stickersApi.downloadBoxes({ ids, size })
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '貼紙生成失敗', 'error'),
  })

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === list.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(list.map((i) => i.id)))
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-bold">需要管理員權限</h1>
        <p className="mt-2 text-sm text-muted">貼紙列印只開放給 Admin 角色使用。</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">貼紙列印</h1>
          <p className="page-subtitle">選擇物品或箱子，生成 PDF 貼紙</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid gap-4 lg:grid-cols-[auto_auto_1fr] lg:items-center">
          <div className="flex rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
            <button
              className={cn('flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors lg:flex-none', mode === 'items' ? 'bg-brand-500 text-white' : 'text-muted hover:bg-white/40 dark:hover:bg-white/10')}
              onClick={() => { setMode('items'); setSelectedIds(new Set()) }}
            >
              <Package className="h-4 w-4" /> 物品
            </button>
            <button
              className={cn('flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors lg:flex-none', mode === 'boxes' ? 'bg-brand-500 text-white' : 'text-muted hover:bg-white/40 dark:hover:bg-white/10')}
              onClick={() => { setMode('boxes'); setSelectedIds(new Set()) }}
            >
              <Box className="h-4 w-4" /> 箱子
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="label whitespace-nowrap">尺寸</label>
            <Select
              className="w-full lg:w-44"
              value={size}
              onChange={setSize}
              options={Object.entries(SIZE_LABELS).map(([value, label]) => ({ value: value as StickerSize, label }))}
            />
          </div>

          <button
            className="btn-primary justify-self-stretch gap-1 lg:justify-self-end"
            disabled={selectedIds.size === 0 || download.isPending}
            onClick={() => download.mutate()}
          >
            <Printer className="h-4 w-4" />
            {download.isPending ? '生成中...' : `下載 PDF (${selectedIds.size})`}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
          <input
            type="checkbox"
            checked={selectedIds.size === list.length && list.length > 0}
            ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < list.length }}
            onChange={toggleAll}
            className="checkbox"
          />
          <span className="text-sm text-muted">
            已選 {selectedIds.size} / {list.length}
          </span>
        </div>

        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {list.map((item) => {
            const isItem = mode === 'items'
            const i = item as any
            const status = i.status as PackingStatus
            return (
              <li
                key={item.id}
                className={cn('flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5', selectedIds.has(item.id) && 'bg-brand-500/10')}
                onClick={() => toggle(item.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="checkbox"
                />
                <div className="flex-1">
                  <p className="font-medium">{isItem ? i.name : i.label}</p>
                  {isItem && i.owner && <p className="text-xs text-muted">{i.owner.name}</p>}
                  {!isItem && i.owner && <p className="text-xs text-muted">負責人: {i.owner.name}</p>}
                </div>
                {isItem && (
                  <span className={cn('badge', STATUS_COLORS[status])}>{STATUS_LABELS[status]}</span>
                )}
                {!isItem && (
                  <span className={cn('badge', STATUS_COLORS[status])}>{STATUS_LABELS[status]}</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/stickers')({ component: StickersPage })
