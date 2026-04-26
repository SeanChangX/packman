import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Printer, Package, Box } from 'lucide-react'
import { itemsApi, boxesApi, stickersApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, cn } from '../lib/utils'

type StickerSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'A4_SHEET'

const SIZE_LABELS: Record<StickerSize, string> = {
  SMALL: '小 (50×30mm)',
  MEDIUM: '中 (100×50mm)',
  LARGE: '大 (150×100mm)',
  A4_SHEET: 'A4 (2×4 格)',
}

function StickersPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">貼紙列印</h1>
        <p className="text-sm text-gray-500">選擇物品或箱子，生成 PDF 貼紙</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          {/* Mode tabs */}
          <div className="flex rounded-lg border p-1">
            <button
              className={cn('flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-colors', mode === 'items' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-50')}
              onClick={() => { setMode('items'); setSelectedIds(new Set()) }}
            >
              <Package className="h-4 w-4" /> 物品
            </button>
            <button
              className={cn('flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-colors', mode === 'boxes' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-50')}
              onClick={() => { setMode('boxes'); setSelectedIds(new Set()) }}
            >
              <Box className="h-4 w-4" /> 箱子
            </button>
          </div>

          {/* Size picker */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">尺寸:</label>
            <select className="input w-auto" value={size} onChange={(e) => setSize(e.target.value as StickerSize)}>
              {Object.entries(SIZE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <button
            className="btn-primary ml-auto gap-1"
            disabled={selectedIds.size === 0 || download.isPending}
            onClick={() => download.mutate()}
          >
            <Printer className="h-4 w-4" />
            {download.isPending ? '生成中...' : `下載 PDF (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {download.isError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {(download.error as Error).message}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <input
            type="checkbox"
            checked={selectedIds.size === list.length && list.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm text-gray-500">
            已選 {selectedIds.size} / {list.length}
          </span>
        </div>

        <ul className="divide-y">
          {list.map((item) => {
            const isItem = mode === 'items'
            const i = item as any
            return (
              <li
                key={item.id}
                className={cn('flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50', selectedIds.has(item.id) && 'bg-brand-50')}
                onClick={() => toggle(item.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded"
                />
                <div className="flex-1">
                  <p className="font-medium">{isItem ? i.name : `箱 ${i.label}`}</p>
                  {isItem && i.owner && <p className="text-xs text-gray-500">{i.owner.name}</p>}
                  {!isItem && i.owner && <p className="text-xs text-gray-500">負責人: {i.owner.name}</p>}
                </div>
                {isItem && (
                  <span className={cn('badge', STATUS_COLORS[i.status])}>{STATUS_LABELS[i.status]}</span>
                )}
                {!isItem && (
                  <span className={cn('badge', STATUS_COLORS[i.status])}>{STATUS_LABELS[i.status]}</span>
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
