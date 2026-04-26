import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'
import { itemsApi, groupsApi, boxesApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, SHIPPING_LABELS, cn } from '../lib/utils'
import { Select } from '../lib/select'
import type { PackingStatus, ShippingMethod } from '@packman/shared'

function ItemsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PackingStatus | ''>('')
  const [shippingFilter, setShippingFilter] = useState<ShippingMethod | ''>('')
  const [groupFilter, setGroupFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['items', search, statusFilter, shippingFilter, groupFilter],
    queryFn: () => itemsApi.list({
      search: search || undefined,
      status: statusFilter || undefined,
      shippingMethod: shippingFilter || undefined,
      groupId: groupFilter || undefined,
      pageSize: 100,
    }),
  })

  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PackingStatus }) =>
      itemsApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">物品清單</h1>
          <p className="page-subtitle">共 {data?.total ?? 0} 件物品</p>
        </div>
        <Link to="/items/new" className="btn-primary gap-1">
          <Plus className="h-4 w-4" /> 新增物品
        </Link>
      </div>

      {/* Filters */}
      <div className="card grid gap-3 p-4 lg:grid-cols-[minmax(16rem,1fr)_auto_auto_auto]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
          <input
            className="input pl-9"
            placeholder="搜尋物品名稱..."
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
            { value: 'SEALED', label: '已封箱' },
          ]}
        />
        <Select
          className="w-full lg:w-40"
          value={shippingFilter}
          onChange={(value) => setShippingFilter(value as ShippingMethod | '')}
          options={[
            { value: '', label: '全部運送' },
            { value: 'CHECKED', label: '託運' },
            { value: 'CARRY_ON', label: '登機' },
          ]}
        />
        <Select
          className="w-full lg:w-40"
          value={groupFilter}
          onChange={setGroupFilter}
          options={[{ value: '', label: '全部組別' }, ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? [])]}
        />
      </div>

      {/* Table */}
      <div className="card table-shell">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <tr>
                {['品項', '負責人', '組別', '運送方式', '數量', '箱子', '狀態', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.data.map((item) => (
                    <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Link
                          to="/items/$id"
                          params={{ id: item.id }}
                          className="font-semibold text-brand-600 hover:underline"
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
                        {item.shippingMethod ? SHIPPING_LABELS[item.shippingMethod] : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">{item.quantity}</td>
                      <td className="px-4 py-3 text-muted">
                        {item.box ? `箱 ${item.box.label}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className={cn('badge cursor-pointer border-0', STATUS_COLORS[item.status])}
                          value={item.status}
                          onChange={(e) => updateStatus.mutate({ id: item.id, status: e.target.value as PackingStatus })}
                        >
                          <option value="NOT_PACKED">尚未裝箱</option>
                          <option value="PACKED">已裝箱</option>
                          <option value="SEALED">已封箱</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
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
    </div>
  )
}

export const Route = createFileRoute('/items')({ component: ItemsPage })
