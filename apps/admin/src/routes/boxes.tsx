import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { adminApi } from '../lib/api'
import { Select } from '../lib/select'

const SHIPPING_OPTIONS = [
  { value: 'CHECKED', label: '託運' },
  { value: 'CARRY_ON', label: '登機' },
] as const

function BoxesPage() {
  const qc = useQueryClient()
  const [shippingMethod, setShippingMethod] = useState('CHECKED')
  const { register, handleSubmit, reset } = useForm<{ label: string; notes?: string }>()
  const { data: boxes } = useQuery({ queryKey: ['admin-boxes'], queryFn: adminApi.boxes })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editShipping, setEditShipping] = useState('CHECKED')
  const [editNotes, setEditNotes] = useState('')

  const create = useMutation({
    mutationFn: (data: { label: string; notes?: string }) =>
      adminApi.createBox({ ...data, shippingMethod }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-boxes'] }); reset() },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { label: string; shippingMethod: string; notes?: string } }) =>
      adminApi.updateBox(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-boxes'] }); setEditingId(null) },
  })

  const del = useMutation({
    mutationFn: adminApi.deleteBox,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-boxes'] }),
  })

  const startEdit = (box: { id: string; label: string; shippingMethod: string; notes?: string | null }) => {
    setEditingId(box.id)
    setEditLabel(box.label)
    setEditShipping(box.shippingMethod)
    setEditNotes(box.notes ?? '')
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">箱子管理</h1>
          <p className="page-subtitle">新增、刪除與自訂箱子名稱</p>
        </div>
      </div>

      <form
        className="card relative z-10 grid gap-3 p-4 md:grid-cols-[1fr_12rem_1fr_auto]"
        onSubmit={handleSubmit((data) => create.mutate(data))}
      >
        <input className="input" placeholder="箱子名稱，例如：工具箱 A" {...register('label', { required: true })} />
        <Select
          value={shippingMethod}
          onChange={setShippingMethod}
          options={SHIPPING_OPTIONS}
        />
        <input className="input" placeholder="備註" {...register('notes')} />
        <button className="btn-primary" disabled={create.isPending}>
          <Plus className="h-4 w-4" /> 新增
        </button>
        {create.isError && (
          <p className="col-span-full text-sm text-red-500">{(create.error as Error).message}</p>
        )}
      </form>

      <div className="card table-shell">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <tr>
                {['名稱', '方式', '狀態', '備註', '操作'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {boxes?.map((box) =>
                editingId === box.id ? (
                  <tr key={box.id} className="bg-brand-500/5">
                    <td className="px-4 py-2">
                      <input
                        className="input py-1.5 text-sm"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={editShipping}
                        onChange={setEditShipping}
                        options={SHIPPING_OPTIONS}
                      />
                    </td>
                    <td className="px-4 py-2 text-muted">{box.status}</td>
                    <td className="px-4 py-2">
                      <input
                        className="input py-1.5 text-sm"
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="備註"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          className="btn-primary px-3"
                          onClick={() => update.mutate({ id: box.id, data: { label: editLabel, shippingMethod: editShipping, notes: editNotes || undefined } })}
                          disabled={update.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button className="btn-secondary px-3" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={box.id}>
                    <td className="px-4 py-3 font-semibold">{box.label}</td>
                    <td className="px-4 py-3 text-muted">{box.shippingMethod === 'CHECKED' ? '託運' : '登機'}</td>
                    <td className="px-4 py-3 text-muted">{box.status}</td>
                    <td className="px-4 py-3 text-muted">{box.notes ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary px-3" onClick={() => startEdit(box)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-danger px-3"
                          onClick={() => { if (confirm(`刪除箱子 ${box.label}？`)) del.mutate(box.id) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/boxes')({ component: BoxesPage })
