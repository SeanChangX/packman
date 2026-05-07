import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Printer, Package, Box, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { useToast } from '@packman/ui'
import { itemsApi, boxesApi, stickersApi } from '../lib/api'
import { STATUS_LABEL_KEYS, STATUS_COLORS, cn } from '../lib/utils'
import { useT } from '../lib/i18n'
import { Select } from '../lib/select'
import { useAuth } from '../lib/auth-context'
import type { PackingStatus } from '@packman/shared'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

type StickerSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'A4_SHEET'

const STICKER_LIMIT = 80
const PAGE_SIZE = STICKER_LIMIT

const SIZE_LABEL_KEYS: Record<StickerSize, string> = {
  SMALL: 'stickers.size.SMALL',
  MEDIUM: 'stickers.size.MEDIUM',
  LARGE: 'stickers.size.LARGE',
  A4_SHEET: 'stickers.size.A4_SHEET',
}

function StickersPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const t = useT()
  const [mode, setMode] = useState<'items' | 'boxes'>('items')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [size, setSize] = useState<StickerSize>('MEDIUM')
  const [page, setPage] = useState(0)
  const [previewing, setPreviewing] = useState(false)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { data: items } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: async () => {
      const all: Awaited<ReturnType<typeof itemsApi.list>>['data'] = []
      let page = 1
      const PAGE_SIZE = 500
      while (true) {
        const res = await itemsApi.list({ page, pageSize: PAGE_SIZE })
        all.push(...res.data)
        if (all.length >= res.total || res.data.length === 0) break
        page++
      }
      return all
    },
  })
  const { data: boxes } = useQuery({
    queryKey: ['boxes'],
    queryFn: () => boxesApi.list(),
  })

  const list = mode === 'items'
    ? (items ?? [])
    : (boxes ?? [])
  const selectedKey = useMemo(() => Array.from(selectedIds).join('|'), [selectedIds])
  const overLimit = selectedIds.size > STICKER_LIMIT
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = useMemo(
    () => list.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [list, safePage],
  )
  const pageSelectedCount = pageItems.filter((i: { id: string }) => selectedIds.has(i.id)).length
  const allOnPageSelected = pageItems.length > 0 && pageSelectedCount === pageItems.length
  const someOnPageSelected = pageSelectedCount > 0 && pageSelectedCount < pageItems.length

  useEffect(() => { setPage(0) }, [mode])

  const fetchStickerBlob = async () => {
    const ids = Array.from(selectedIds)
    const endpoint = mode === 'items' ? '/api/stickers/items' : '/api/stickers/boxes'
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, size }),
    })
    if (!res.ok) throw new Error(`${t('stickers.fail.generate')} (${res.status})`)
    return res.blob()
  }

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
        const containerW = canvas.parentElement?.clientWidth ?? 900
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

  useEffect(() => {
    if (!previewBlob) return
    if (selectedIds.size === 0) {
      setPreviewBlob(null)
      return
    }
    let cancelled = false
    fetchStickerBlob().then((blob) => { if (!cancelled) setPreviewBlob(blob) }).catch(() => {})
    return () => { cancelled = true }
  }, [mode, size, selectedKey])

  const download = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds)
      if (mode === 'items') await stickersApi.downloadItems({ ids, size })
      else await stickersApi.downloadBoxes({ ids, size })
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('stickers.fail.generate'), 'error'),
  })

  const previewSticker = async () => {
    if (previewBlob) {
      setPreviewBlob(null)
      return
    }
    setPreviewing(true)
    try {
      setPreviewBlob(await fetchStickerBlob())
    } catch (e: unknown) {
      showToast((e as Error)?.message ?? t('stickers.fail.preview'), 'error')
    } finally {
      setPreviewing(false)
    }
  }

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev)
      const allSelected = pageItems.length > 0 && pageItems.every((i: { id: string }) => next.has(i.id))
      if (allSelected) {
        for (const i of pageItems) next.delete(i.id)
      } else {
        for (const i of pageItems) next.add(i.id)
      }
      return next
    })
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-bold">{t('stickers.adminOnly.title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('stickers.adminOnly.body')}</p>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('stickers.title')}</h1>
          <p className="page-subtitle">{t('stickers.subtitle')}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid gap-4 lg:grid-cols-[auto_auto_1fr] lg:items-center">
          <div className="flex rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
            <button
              className={cn('flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors lg:flex-none', mode === 'items' ? 'bg-brand-500 text-white' : 'text-muted hover:bg-white/40 dark:hover:bg-white/10')}
              onClick={() => { setMode('items'); setSelectedIds(new Set()) }}
            >
              <Package className="h-4 w-4" /> {t('stickers.mode.items')}
            </button>
            <button
              className={cn('flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors lg:flex-none', mode === 'boxes' ? 'bg-brand-500 text-white' : 'text-muted hover:bg-white/40 dark:hover:bg-white/10')}
              onClick={() => { setMode('boxes'); setSelectedIds(new Set()) }}
            >
              <Box className="h-4 w-4" /> {t('stickers.mode.boxes')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="label whitespace-nowrap">{t('stickers.size')}</label>
            <Select
              className="w-full lg:w-44"
              value={size}
              onChange={setSize}
              options={Object.entries(SIZE_LABEL_KEYS).map(([value, key]) => ({ value: value as StickerSize, label: t(key) }))}
            />
          </div>

          <div className="grid gap-2 justify-self-stretch sm:grid-cols-2 lg:justify-self-end">
            <button
              className="btn-secondary justify-center gap-1"
              disabled={selectedIds.size === 0 || overLimit || previewing || download.isPending}
              onClick={previewSticker}
            >
              <Eye className="h-4 w-4" />
              {previewing ? t('stickers.previewing') : previewBlob ? t('stickers.closePreview') : t('stickers.preview', { n: selectedIds.size })}
            </button>
            <button
              className="btn-primary justify-center gap-1"
              disabled={selectedIds.size === 0 || overLimit || download.isPending || previewing}
              onClick={() => download.mutate()}
            >
              <Printer className="h-4 w-4" />
              {download.isPending ? t('stickers.generating') : t('stickers.download', { n: selectedIds.size })}
            </button>
          </div>
        </div>
      </div>

      {previewBlob && (
        <div className="card overflow-hidden">
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
            <h2 className="font-semibold">{t('stickers.previewTitle')}</h2>
            <p className="text-xs text-muted">{t('stickers.previewHint')}</p>
          </div>
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

      <div className="card overflow-hidden">
        <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              ref={(el) => { if (el) el.indeterminate = someOnPageSelected }}
              onChange={toggleAll}
              className="h-4 w-4 cursor-pointer accent-brand-500"
            />
            <span className="text-sm text-muted">
              {t('stickers.selected', { n: selectedIds.size, total: list.length })}
            </span>
            {totalPages > 1 && (
              <div className="ml-auto flex items-center gap-1 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  aria-label={t('stickers.page.prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs font-medium tabular-nums text-muted">
                  {t('stickers.page.indicator', { current: safePage + 1, total: totalPages })}
                </span>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage(safePage + 1)}
                  aria-label={t('stickers.page.next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <p className={cn('mt-1 pl-7 text-xs', overLimit ? 'font-semibold text-red-500' : 'text-muted')}>
            {overLimit
              ? t('stickers.limit.exceeded', { n: selectedIds.size, max: STICKER_LIMIT })
              : t('stickers.limit.hint', { max: STICKER_LIMIT })}
          </p>
        </div>

        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {pageItems.map((item: { id: string }) => {
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
                  className="h-4 w-4 cursor-pointer accent-brand-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={isItem ? i.name : i.label}>{isItem ? i.name : i.label}</p>
                  {i.owner && <p className="truncate text-xs text-muted" title={i.owner.name}>{i.owner.name}</p>}
                </div>
                {isItem && (
                  <span className={cn('badge', STATUS_COLORS[status])}>{t(STATUS_LABEL_KEYS[status])}</span>
                )}
                {!isItem && (
                  <span className={cn('badge', STATUS_COLORS[status])}>{t(STATUS_LABEL_KEYS[status])}</span>
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
