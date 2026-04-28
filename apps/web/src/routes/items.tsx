import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useToast } from '@packman/ui'
import { itemsApi, groupsApi, selectOptionsApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, getLabelFromOptions, cn, formatApiError } from '../lib/utils'
import { Select } from '../lib/select'
import { useAuth } from '../lib/auth-context'
import type { PackingStatus } from '@packman/shared'

function ItemsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()
  const isAdmin = user?.role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PackingStatus | ''>('')
  const [shippingFilter, setShippingFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const PAGE_SIZE = 50
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['items', debouncedSearch, statusFilter, shippingFilter, groupFilter],
    queryFn: ({ pageParam = 1 }) => itemsApi.list({
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      shippingMethod: shippingFilter || undefined,
      groupId: groupFilter || undefined,
      page: pageParam as number,
      pageSize: PAGE_SIZE,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.data.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        fetchNextPage()
      }
    }, { rootMargin: '400px' })
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const { data: shippingOpts = [] } = useQuery({ queryKey: ['options', 'SHIPPING_METHOD'], queryFn: () => selectOptionsApi.list('SHIPPING_METHOD') })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PackingStatus }) =>
      itemsApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
  })

  const batchDelete = useMutation({
    mutationFn: (ids: string[]) => itemsApi.batchDelete(ids),
    onSuccess: () => {
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['items'] })
      showToast('已刪除選取物品', 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
  })

  const items = data?.pages.flatMap((p) => p.data) ?? []
  const total = data?.pages[0]?.total ?? 0
  const allChecked = items.length > 0 && selected.size === items.length
  const someChecked = selected.size > 0 && selected.size < items.length

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(items.map((i) => i.id)))
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBatchDelete = () => {
    if (!confirm(`確定刪除選取的 ${selected.size} 件物品？此操作無法復原。`)) return
    batchDelete.mutate([...selected])
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">物品清單</h1>
          <p className="page-subtitle">共 {total} 件物品（已載入 {items.length}）</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && selected.size > 0 && (
            <button
              onClick={handleBatchDelete}
              disabled={batchDelete.isPending}
              className="btn-primary gap-1 bg-brand-600 hover:bg-brand-700"
            >
              <Trash2 className="h-4 w-4" /> 刪除 {selected.size} 件
            </button>
          )}
          <Link to="/items/new" className="btn-primary gap-1">
            <Plus className="h-4 w-4" /> 新增物品
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card grid gap-3 p-4 lg:grid-cols-[minmax(16rem,1fr)_auto_auto_auto]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
          <input
            className="input pl-9"
            placeholder="搜尋物品名稱或 tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="w-full lg:w-40"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as PackingStatus | '')}
          options={[
            { value: '', label: '全部狀態' },
            { value: 'NOT_PACKED', label: '尚未裝箱' },
            { value: 'PACKED', label: '已裝箱' },
          ]}
        />
        <Select
          className="w-full lg:w-40"
          value={shippingFilter}
          onChange={setShippingFilter}
          options={[
            { value: '', label: '全部運送' },
            ...shippingOpts.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />
        <Select
          className="w-full lg:w-40"
          value={groupFilter}
          onChange={setGroupFilter}
          options={[{ value: '', label: '全部組別' }, ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? [])]}
        />
      </div>

      {/* Mobile list */}
      <div className="card overflow-hidden md:hidden">
        {isLoading
          ? (
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-3 p-4">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-4 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-black/10 dark:bg-white/10" />
                  </div>
                ))}
              </div>
            )
          : items.length === 0
            ? <div className="p-6 text-center text-sm text-muted">沒有符合條件的物品</div>
            : (
                <div className="divide-y divide-black/5 dark:divide-white/10">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'p-4 transition-colors active:bg-black/5 dark:active:bg-white/5',
                        isAdmin && selected.has(item.id) && 'bg-brand-500/5',
                      )}
                      onClick={isAdmin ? () => toggle(item.id) : undefined}
                    >
                      <div className="flex items-start gap-3">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggle(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-brand-500"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <Link
                              to="/items/$id"
                              params={{ id: item.id }}
                              className="min-w-0 flex-1 truncate text-base font-semibold text-brand-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.name}
                            </Link>
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={item.status}
                                onChange={(v) => updateStatus.mutate({ id: item.id, status: v as PackingStatus })}
                                triggerClassName={cn('badge cursor-pointer border-0', STATUS_COLORS[item.status])}
                                options={[
                                  { value: 'NOT_PACKED', label: '尚未裝箱' },
                                  { value: 'PACKED', label: '已裝箱' },
                                ]}
                              />
                            </div>
                          </div>

                          {item.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.tags.slice(0, 4).map((t) => (
                                <span key={t} className="badge max-w-[8rem] truncate bg-black/5 text-muted dark:bg-white/10">{t}</span>
                              ))}
                              {item.tags.length > 4 && (
                                <span className="badge bg-black/5 text-muted dark:bg-white/10">+{item.tags.length - 4}</span>
                              )}
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-muted">負責人</p>
                              {item.owner
                                ? (
                                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-app">
                                      {item.owner.avatarUrl && <img src={item.owner.avatarUrl} className="h-5 w-5 shrink-0 rounded-full" alt="" />}
                                      <span className="truncate">{item.owner.name}</span>
                                    </div>
                                  )
                                : <p className="mt-1 text-muted">—</p>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-muted">組別</p>
                              <div className="mt-1">
                                {item.group
                                  ? <span className="badge max-w-full truncate" style={{ backgroundColor: item.group.color + '20', color: item.group.color }}>{item.group.name}</span>
                                  : <span className="text-muted">—</span>}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-muted">運送</p>
                              <p className="mt-1 truncate text-app">{item.shippingMethod ? getLabelFromOptions(shippingOpts, item.shippingMethod) : '—'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-muted">數量 / 箱子</p>
                              <p className="mt-1 truncate text-app">{item.quantity} / {item.box?.label ?? '—'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-muted">重量</p>
                              <p className="mt-1 truncate text-app">
                                {item.weightG != null ? `${item.weightG.toLocaleString()} g` : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
      </div>

      {/* Mobile sentinel */}
      <div ref={sentinelRef} className="md:hidden">
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card table-shell hidden md:block">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <tr>
                {isAdmin && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer accent-brand-500"
                    />
                  </th>
                )}
                {['品項', '負責人', '組別', '運送方式', '數量', '重量', '箱子', '狀態', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: isAdmin ? 9 : 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-white/10" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(isAdmin && selected.has(item.id) ? 'bg-brand-500/5' : 'hover:bg-black/5 dark:hover:bg-white/5')}
                      onClick={isAdmin ? () => toggle(item.id) : undefined}
                    >
                      {isAdmin && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggle(item.id)}
                            className="h-4 w-4 cursor-pointer accent-brand-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          to="/items/$id"
                          params={{ id: item.id }}
                          className="font-semibold text-brand-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.name}
                        </Link>
                        {item.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.tags.slice(0, 3).map((t) => (
                              <span key={t} className="badge bg-black/5 text-muted dark:bg-white/10">{t}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {item.owner
                          ? <span className="flex items-center gap-1">
                              {item.owner.avatarUrl && <img src={item.owner.avatarUrl} className="h-5 w-5 rounded-full" alt="" />}
                              {item.owner.name}
                            </span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.group
                          ? <span className="badge" style={{ backgroundColor: item.group.color + '20', color: item.group.color }}>{item.group.name}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {item.shippingMethod ? getLabelFromOptions(shippingOpts, item.shippingMethod) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">{item.quantity}</td>
                      <td className="px-4 py-3 text-muted">
                        {item.weightG != null ? `${item.weightG.toLocaleString()} g` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {item.box?.label ?? '—'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={item.status}
                          onChange={(v) => updateStatus.mutate({ id: item.id, status: v as PackingStatus })}
                          triggerClassName={cn('badge cursor-pointer border-0', STATUS_COLORS[item.status])}
                          options={[
                            { value: 'NOT_PACKED', label: '尚未裝箱' },
                            { value: 'PACKED', label: '已裝箱' },
                          ]}
                        />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          to="/items/$id"
                          params={{ id: item.id }}
                          className="font-semibold text-muted hover:text-brand-600"
                        >
                          詳細
                        </Link>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Desktop sentinel */}
      <div className="hidden md:block">
        <div ref={sentinelRef} />
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/items')({ component: ItemsPage })
