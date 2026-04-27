import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, X, Trash2 } from 'lucide-react'
import { boxesApi, usersApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, cn, formatApiError } from '../lib/utils'
import { Select, SelectController } from '../lib/select'
import type { CreateBoxInput, PackingStatus } from '@packman/shared'
import { useAuth } from '../lib/auth-context'

function NewBoxModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { register, handleSubmit, control } = useForm<CreateBoxInput>()

  const create = useMutation({
    mutationFn: boxesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['boxes'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">新增箱子</h2>
          <button onClick={onClose} className="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit((d) => create.mutate(d))}>
          <div>
            <label className="label">箱子編號 *</label>
            <input className="input mt-1" placeholder="例: 1, A, 大機, 推車1" {...register('label', { required: true })} />
          </div>
          <div>
            <label className="label">運送方式 *</label>
            <SelectController
              name="shippingMethod"
              control={control}
              className="mt-1"
              placeholder="— 請選擇 —"
              options={[
                { value: 'CHECKED', label: '託運' },
                { value: 'CARRY_ON', label: '登機' },
              ]}
            />
          </div>
          <div>
            <label className="label">整箱負責人</label>
            <SelectController
              name="ownerId"
              control={control}
              className="mt-1"
              placeholder="— 請選擇 —"
              options={[
                { value: '', label: '— 請選擇 —' },
                ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
              ]}
            />
          </div>
          <div>
            <label className="label">說明</label>
            <input className="input mt-1" {...register('notes')} />
          </div>
          {create.isError && (
            <p className="text-sm text-red-500">{formatApiError(create.error)}</p>
          )}
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
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [showNew, setShowNew] = useState(false)
  const { data: boxes, isLoading } = useQuery({ queryKey: ['boxes'], queryFn: () => boxesApi.list() })

  const deleteBox = useMutation({
    mutationFn: (id: string) => boxesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boxes'] }),
    onError: (e: unknown) => alert(formatApiError(e)),
  })

  const updateBoxStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PackingStatus }) =>
      boxesApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boxes'] }),
    onError: (e: unknown) => alert(formatApiError(e)),
  })

  const checked = boxes?.filter((b) => b.shippingMethod === 'CHECKED') ?? []
  const carryOn = boxes?.filter((b) => b.shippingMethod === 'CARRY_ON') ?? []

  const BoxCard = ({ box }: { box: typeof boxes extends (infer T)[] | undefined ? T : never }) => (
    <div className="card flex gap-3 p-4 transition-shadow hover:shadow-md">
      <Link to="/boxes/$id" params={{ id: box!.id }} className="flex-1 min-w-0">
        <span className="text-2xl font-bold text-app">{box!.label}</span>
        {box!.owner && (
          <p className="mt-1 text-sm text-muted">負責人: {box!.owner.name}</p>
        )}
        <p className="mt-2 text-xs text-muted">{(box as any)._count?.items ?? 0} 件物品</p>
      </Link>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        {isAdmin
          ? <Select
              value={box!.status}
              onChange={(v) => updateBoxStatus.mutate({ id: box!.id, status: v as PackingStatus })}
              triggerClassName={cn('badge cursor-pointer border-0', STATUS_COLORS[box!.status])}
              options={[
                { value: 'NOT_PACKED', label: '尚未裝箱' },
                { value: 'PACKED', label: '已裝箱' },
                { value: 'SEALED', label: '已封箱' },
              ]}
            />
          : <span className={cn('badge', STATUS_COLORS[box!.status])}>
              {STATUS_LABELS[box!.status]}
            </span>
        }
        {isAdmin && (
          <button
            onClick={() => { if (confirm(`確定刪除箱子「${box!.label}」？`)) deleteBox.mutate(box!.id) }}
            className="rounded-xl p-1 text-muted hover:bg-brand-500/10 hover:text-brand-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">箱子清單</h1>
          <p className="page-subtitle">託運與登機箱狀態</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="btn-primary gap-1" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> 新增箱子
          </button>
        )}
      </div>

      {isLoading
        ? <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        : (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 font-semibold text-muted">託運箱 ({checked.length})</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {checked.map((b) => <BoxCard key={b.id} box={b} />)}
              </div>
            </section>
            <section>
              <h2 className="mb-3 font-semibold text-muted">登機箱 ({carryOn.length})</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
