import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'
import { itemsApi, groupsApi, boxesApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, SHIPPING_LABELS, cn } from '../lib/utils'
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">物品清單</h1>
          <p className="text-sm text-gray-500">共 {data?.total ?? 0} 件物品</p>
        </div>
        <Link to="/items/new" className="btn-primary gap-1">
          <Plus className="h-4 w-4" /> 新增物品
        </Link>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 p-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="搜尋物品名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="">全部狀態</option>
          <option value="NOT_PACKED">尚未裝箱</option>
          <option value="PACKED">已裝箱</option>
          <option value="SEALED">已封箱</option>
        </select>
        <select className="input w-auto" value={shippingFilter} onChange={(e) => setShippingFilter(e.target.value as any)}>
          <option value="">全部運送方式</option>
          <option value="CHECKED">託運</option>
          <option value="CARRY_ON">登機</option>
        </select>
        <select className="input w-auto" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">全部組別</option>
          {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                {['品項', '負責人', '組別', '運送方式', '數量', '箱子', '狀態', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to="/items/$id"
                          params={{ id: item.id }}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {item.name}
                        </Link>
                        {item.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.tags.slice(0, 3).map((t) => (
                              <span key={t} className="badge bg-gray-100 text-gray-600">{t}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
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
                      <td className="px-4 py-3 text-gray-600">
                        {item.shippingMethod ? SHIPPING_LABELS[item.shippingMethod] : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-gray-600">
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
                          className="text-gray-400 hover:text-gray-600"
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
