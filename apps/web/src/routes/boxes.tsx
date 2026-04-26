import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, X } from 'lucide-react'
import { boxesApi, usersApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, SHIPPING_LABELS, cn } from '../lib/utils'
import type { CreateBoxInput } from '@packman/shared'

function NewBoxModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { register, handleSubmit } = useForm<CreateBoxInput>()

  const create = useMutation({
    mutationFn: boxesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['boxes'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">新增箱子</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit((d) => create.mutate(d))}>
          <div>
            <label className="label">箱子編號 *</label>
            <input className="input mt-1" placeholder="例: 1, A, 大機, 推車1" {...register('label', { required: true })} />
          </div>
          <div>
            <label className="label">運送方式 *</label>
            <select className="input mt-1" {...register('shippingMethod', { required: true })}>
              <option value="">— 請選擇 —</option>
              <option value="CHECKED">託運</option>
              <option value="CARRY_ON">登機</option>
            </select>
          </div>
          <div>
            <label className="label">整箱負責人</label>
            <select className="input mt-1" {...register('ownerId')}>
              <option value="">— 請選擇 —</option>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">說明</label>
            <input className="input mt-1" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>新增</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BoxesPage() {
  const [showNew, setShowNew] = useState(false)
  const { data: boxes, isLoading } = useQuery({ queryKey: ['boxes'], queryFn: () => boxesApi.list() })

  const checked = boxes?.filter((b) => b.shippingMethod === 'CHECKED') ?? []
  const carryOn = boxes?.filter((b) => b.shippingMethod === 'CARRY_ON') ?? []

  const BoxCard = ({ box }: { box: typeof boxes extends (infer T)[] | undefined ? T : never }) => (
    <Link
      to="/boxes/$id"
      params={{ id: box!.id }}
      className="card block p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-2xl font-bold text-gray-900">箱 {box!.label}</span>
          {box!.owner && (
            <p className="mt-1 text-sm text-gray-500">負責人: {box!.owner.name}</p>
          )}
        </div>
        <span className={cn('badge', STATUS_COLORS[box!.status])}>
          {STATUS_LABELS[box!.status]}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400">{(box as any)._count?.items ?? 0} 件物品</p>
    </Link>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">箱子管理</h1>
        <button className="btn-primary gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> 新增箱子
        </button>
      </div>

      {isLoading
        ? <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        : (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 font-semibold text-gray-700">託運箱 ({checked.length})</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {checked.map((b) => <BoxCard key={b.id} box={b} />)}
              </div>
            </section>
            <section>
              <h2 className="mb-3 font-semibold text-gray-700">登機箱 ({carryOn.length})</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {carryOn.map((b) => <BoxCard key={b.id} box={b} />)}
              </div>
            </section>
          </div>
        )
      }

      {showNew && <NewBoxModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

export const Route = createFileRoute('/boxes')({ component: BoxesPage })
