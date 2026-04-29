import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Download, Eye, CheckSquare, Square } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { boxesApi, itemsApi, usersApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, SHIPPING_LABELS, cn } from '../lib/utils'
import { Select } from '../lib/select'
import { useAuth } from '../lib/auth-context'
import type { PackingStatus, UpdateBoxInput, User } from '@packman/shared'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

function BoxDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [stickerSize, setStickerSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE' | 'A4_SHEET'>('MEDIUM')
  const [downloading, setDownloading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { data: box, isLoading } = useQuery({
    queryKey: ['box', id],
    queryFn: () => boxesApi.get(id),
  })
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: isAdmin,
  })

  // Re-render canvas whenever the blob changes
  useEffect(() => {
    if (!previewBlob) return
    let cancelled = false
    setRendering(true)

    const render = async () => {
      try {
        const arrayBuffer = await previewBlob.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page = await pdf.getPage(1)
        if (cancelled || !canvasRef.current) return

        const canvas = canvasRef.current
        const containerW = canvas.parentElement?.clientWidth ?? 600
        const viewport = page.getViewport({ scale: 1 })
        const scale = Math.min(containerW / viewport.width, 2)
        const scaled = page.getViewport({ scale })
        canvas.width = scaled.width
        canvas.height = scaled.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport: scaled }).promise
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    render()
    return () => { cancelled = true }
  }, [previewBlob])

  const fetchStickerBlob = async () => {
    const res = await fetch(boxesApi.stickerUrl(id, stickerSize), { credentials: 'include' })
    if (!res.ok) throw new Error(`貼紙生成失敗 (${res.status})`)
    return res.blob()
  }

  // Auto-refresh preview when size changes while preview is open
  useEffect(() => {
    if (!previewBlob) return
    let cancelled = false
    fetchStickerBlob().then((blob) => { if (!cancelled) setPreviewBlob(blob) }).catch(() => {})
    return () => { cancelled = true }
  }, [stickerSize])

  const previewSticker = async () => {
    if (previewBlob) { setPreviewBlob(null); return }
    setPreviewing(true)
    try {
      setPreviewBlob(await fetchStickerBlob())
    } catch (err) {
      alert(err instanceof Error ? err.message : '預覽失敗')
    } finally {
      setPreviewing(false)
    }
  }

  const downloadSticker = async () => {
    setDownloading(true)
    try {
      const blob = await fetchStickerBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `box-${box?.label ?? id}-sticker.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      alert(err instanceof Error ? err.message : '下載失敗')
    } finally {
      setDownloading(false)
    }
  }

  const updateItem = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: PackingStatus }) =>
      itemsApi.update(itemId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['box', id] }),
  })

  const updateBox = useMutation({
    mutationFn: (data: UpdateBoxInput) => boxesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['box', id] })
      qc.invalidateQueries({ queryKey: ['boxes'] })
    },
  })

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
  if (!box) return <p>箱子不存在</p>

  const items = box.items ?? []
  const packedCount = items.filter((i) => i.status !== 'NOT_PACKED').length
  const getOwnerOptions = (owner?: Pick<User, 'id' | 'name'>) => [
    { value: '', label: '— 未指定 —' },
    ...(owner && !users?.some((u) => u.id === owner.id)
      ? [{ value: owner.id, label: owner.name }]
      : []),
    ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: '/boxes' })} className="rounded-2xl p-2 text-muted transition-colors hover:bg-white/10 hover:text-app">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="page-title truncate">{box.label}</h1>
            <span className="badge shrink-0 bg-black/10 text-app dark:bg-white/10">{SHIPPING_LABELS[box.shippingMethod]}</span>
            <span className="ml-1 text-sm text-muted">{packedCount}/{items.length}</span>
            {isAdmin
              ? <Select
                  value={box.status}
                  onChange={(v) => updateBox.mutate({ status: v as PackingStatus })}
                  triggerClassName={cn('badge cursor-pointer border-0', STATUS_COLORS[box.status])}
                  options={[
                    { value: 'NOT_PACKED', label: '尚未裝箱' },
                    { value: 'PACKED', label: '已裝箱' },
                    { value: 'SEALED', label: '已封箱' },
                  ]}
                />
              : <span className={cn('badge shrink-0', STATUS_COLORS[box.status])}>{STATUS_LABELS[box.status]}</span>
            }
          </div>
          {isAdmin ? (
            <div className="mt-2 grid max-w-xs grid-cols-[5.5rem_1fr] items-center gap-2">
              <span className="text-sm text-muted">整箱負責人</span>
              <Select
                value={box.ownerId ?? ''}
                onChange={(v) => updateBox.mutate({ ownerId: v || null })}
                options={getOwnerOptions(box.owner)}
              />
            </div>
          ) : box.owner && (
            <p className="text-sm text-muted">整箱負責人: {box.owner.name}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="card space-y-2 p-4">
        {/* Row 1: size selector */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-semibold text-muted">貼紙尺寸</span>
          <Select
            className="flex-1"
            value={stickerSize}
            onChange={(v) => setStickerSize(v as typeof stickerSize)}
            options={[
              { value: 'SMALL', label: '小 (50×30mm)' },
              { value: 'MEDIUM', label: '中 (100×50mm)' },
              { value: 'LARGE', label: '大 (150×100mm)' },
              { value: 'A4_SHEET', label: 'A4 (2×4 格)' },
            ]}
          />
        </div>
        {/* Row 2: action buttons */}
        <div className="flex gap-2">
          <button onClick={previewSticker} disabled={previewing || downloading} className="btn-secondary flex-1 justify-center gap-1">
            <Eye className="h-4 w-4" /> {previewing ? '生成中...' : previewBlob ? '關閉預覽' : '預覽'}
          </button>
          <button onClick={downloadSticker} disabled={downloading || previewing} className="btn-secondary flex-1 justify-center gap-1">
            <Download className="h-4 w-4" /> {downloading ? '生成中...' : '下載'}
          </button>
        </div>
      </div>

      {/* Sticker inline preview */}
      {previewBlob && (
        <div className="card overflow-hidden">
          {rendering && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ display: rendering ? 'none' : 'block' }}
          />
        </div>
      )}

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
                  <li key={item.id} className="flex items-center gap-1 pr-2 active:bg-white/5">
                    <button
                      type="button"
                      aria-label={isPacked ? '標記為尚未裝箱' : '標記為已裝箱'}
                      onClick={() =>
                        updateItem.mutate({
                          itemId: item.id,
                          status: isPacked ? 'NOT_PACKED' : 'PACKED',
                        })
                      }
                      className="flex-shrink-0 rounded-2xl p-3 text-muted transition-colors hover:bg-white/10"
                    >
                      {isPacked
                        ? <CheckSquare className="h-6 w-6 text-brand-500" />
                        : <Square className="h-6 w-6 text-muted" />}
                    </button>
                    <Link
                      to="/items/$id"
                      params={{ id: item.id }}
                      className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-2 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn('block font-medium', isPacked && 'text-muted line-through')}>
                          {item.name}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          <span>負責人: {item.owner?.name ?? '未指定'}</span>
                          <span>
                            組別:{' '}
                            {item.group
                              ? <span style={{ color: item.group.color }}>{item.group.name}</span>
                              : '未分組'}
                          </span>
                          <span>數量: {item.quantity}</span>
                        </span>
                      </span>
                      <span className={cn('badge shrink-0 text-xs', STATUS_COLORS[item.status])}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </Link>
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
