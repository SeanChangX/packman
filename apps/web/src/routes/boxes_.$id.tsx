import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Download, QrCode, CheckSquare, Square } from 'lucide-react'
import { boxesApi, itemsApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, SHIPPING_LABELS, cn } from '../lib/utils'
import { Select } from '../lib/select'
import type { PackingStatus } from '@packman/shared'

function BoxDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [stickerSize, setStickerSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE' | 'A4_SHEET'>('MEDIUM')

  const { data: box, isLoading } = useQuery({
    queryKey: ['box', id],
    queryFn: () => boxesApi.get(id),
  })

  const updateItem = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: PackingStatus }) =>
      itemsApi.update(itemId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['box', id] }),
  })

  const updateBox = useMutation({
    mutationFn: (status: PackingStatus) => boxesApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['box', id] }),
  })

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
  if (!box) return <p>箱子不存在</p>

  const items = box.items ?? []
  const packedCount = items.filter((i) => i.status !== 'NOT_PACKED').length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: '/boxes' })} className="rounded-2xl p-2 text-muted transition-colors hover:bg-white/10 hover:text-app">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="page-title">箱 {box.label}</h1>
            <span className="badge bg-black/10 text-app dark:bg-white/10">{SHIPPING_LABELS[box.shippingMethod]}</span>
          </div>
          {box.owner && <p className="text-sm text-muted">整箱負責人: {box.owner.name}</p>}
        </div>
        <span className={cn('badge text-sm', STATUS_COLORS[box.status])}>{STATUS_LABELS[box.status]}</span>
      </div>

      {/* Actions */}
      <div className="card flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex items-center gap-2">
          <label className="label">貼紙尺寸:</label>
          <Select
            className="w-full sm:w-44"
            value={stickerSize}
            onChange={(v) => setStickerSize(v as typeof stickerSize)}
            options={[
              { value: 'SMALL', label: '小 (50×30mm)' },
              { value: 'MEDIUM', label: '中 (100×50mm)' },
              { value: 'LARGE', label: '大 (150×100mm)' },
              { value: 'A4', label: 'A4' },
            ]}
          />
        </div>
        <a
          href={boxesApi.stickerUrl(id, stickerSize)}
          download
          className="btn-secondary gap-1"
        >
          <Download className="h-4 w-4" /> 下載貼紙
        </a>
        <a href={boxesApi.qrUrl(id)} download className="btn-secondary gap-1">
          <QrCode className="h-4 w-4" /> QR Code
        </a>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted">{packedCount} / {items.length} 已打包</span>
          <Select
            value={box.status}
            onChange={(v) => updateBox.mutate(v as PackingStatus)}
            triggerClassName={cn('badge cursor-pointer border-0', STATUS_COLORS[box.status])}
            options={[
              { value: 'NOT_PACKED', label: '尚未裝箱' },
              { value: 'PACKED', label: '已裝箱' },
              { value: 'SEALED', label: '已封箱' },
            ]}
          />
        </div>
      </div>

      {/* QR preview */}
      <div className="card flex items-center gap-4 p-4">
        <img src={boxesApi.qrUrl(id)} alt="QR" className="h-20 w-20 rounded" />
        <div>
          <p className="font-medium">掃描此 QR Code</p>
          <p className="text-sm text-muted">開啟箱子清單，勾選已清點物品</p>
        </div>
      </div>

      {/* Items checklist */}
      <div className="card">
        <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
          <h2 className="font-semibold">物品清單 ({items.length})</h2>
        </div>
        {items.length === 0
          ? <p className="py-8 text-center text-sm text-muted">此箱子尚無物品</p>
          : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {items.map((item) => {
                const isPacked = item.status !== 'NOT_PACKED'
                return (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() =>
                        updateItem.mutate({
                          itemId: item.id,
                          status: isPacked ? 'NOT_PACKED' : 'PACKED',
                        })
                      }
                      className="flex-shrink-0 text-brand-500"
                    >
                        {isPacked ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-muted" />}
                    </button>
                    <div className="flex-1">
                      <span className={cn('font-medium', isPacked && 'text-muted line-through')}>
                        {item.name}
                      </span>
                      <div className="flex gap-2 text-xs text-muted">
                        {item.quantity > 1 && <span>× {item.quantity}</span>}
                        {item.owner && <span>{item.owner.name}</span>}
                        {item.group && <span style={{ color: item.group.color }}>{item.group.name}</span>}
                      </div>
                    </div>
                    <span className={cn('badge text-xs', STATUS_COLORS[item.status])}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        }
      </div>
    </div>
  )
}

export const Route = createFileRoute('/boxes_/$id')({ component: BoxDetailPage })
