import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { adminApi } from '../lib/api'
import { Select } from '../lib/select'

function BoxesPage() {
  const qc = useQueryClient()
  const [shippingMethod, setShippingMethod] = useState('CHECKED')
  const { register, handleSubmit, reset } = useForm<{ label: string; notes?: string }>()
  const { data: boxes } = useQuery({ queryKey: ['admin-boxes'], queryFn: adminApi.boxes })

  const create = useMutation({
    mutationFn: (data: { label: string; notes?: string }) =>
      adminApi.createBox({ ...data, shippingMethod }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-boxes'] })
      reset()
    },
  })

  const del = useMutation({
    mutationFn: adminApi.deleteBox,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-boxes'] }),
  })

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">箱子管理</h1>
          <p className="page-subtitle">新增、刪除與自訂箱子名稱</p>
        </div>
      </div>

      <form className="card grid gap-3 p-4 md:grid-cols-[1fr_12rem_1fr_auto]" onSubmit={handleSubmit((data) => create.mutate(data))}>
        <input className="input" placeholder="箱子名稱，例如：工具箱 A" {...register('label', { required: true })} />
        <Select
          value={shippingMethod}
          onChange={setShippingMethod}
          options={[
            { value: 'CHECKED', label: '託運' },
            { value: 'CARRY_ON', label: '登機' },
          ]}
        />
        <input className="input" placeholder="備註" {...register('notes')} />
        <button className="btn-primary" disabled={create.isPending}>
          <Plus className="h-4 w-4" /> 新增
        </button>
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
              {boxes?.map((box) => (
                <tr key={box.id}>
                  <td className="px-4 py-3 font-semibold">箱 {box.label}</td>
                  <td className="px-4 py-3 text-muted">{box.shippingMethod === 'CHECKED' ? '託運' : '登機'}</td>
                  <td className="px-4 py-3 text-muted">{box.status}</td>
                  <td className="px-4 py-3 text-muted">{box.notes ?? '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      className="btn-danger px-3"
                      onClick={() => { if (confirm(`刪除箱子 ${box.label}？`)) del.mutate(box.id) }}
                    >
                      <Trash2 className="h-4 w-4" /> 刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/boxes')({ component: BoxesPage })
