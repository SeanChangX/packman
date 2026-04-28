import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Package, Plus, Trash2, UserRound, Weight, X } from 'lucide-react'
import { useToast } from '@packman/ui'
import { boxesApi, usersApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, cn, formatApiError } from '../lib/utils'
import { Select, SelectController } from '../lib/select'
import type { CreateBoxInput, PackingStatus, UpdateBoxInput, User } from '@packman/shared'
import { useAuth } from '../lib/auth-context'

const STATUS_OPTIONS = [
  { value: 'NOT_PACKED', label: '尚未裝箱' },
  { value: 'PACKED', label: '已裝箱' },
  { value: 'SEALED', label: '已封箱' },
] as const

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
            <input className="input mt-1" placeholder="例: A箱, 大機, 推車1號" {...register('label', { required: true })} />
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
  const { showToast } = useToast()
  const isAdmin = user?.role === 'ADMIN'
  const [showNew, setShowNew] = useState(false)
  const { data: boxes, isLoading } = useQuery({ queryKey: ['boxes'], queryFn: () => boxesApi.list() })
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: isAdmin,
  })

  const deleteBox = useMutation({
    mutationFn: (id: string) => boxesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boxes'] })
      showToast('箱子已刪除', 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
  })

  const updateBox = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBoxInput }) =>
      boxesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boxes'] }),
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
  })

  const checked = boxes?.filter((b) => b.shippingMethod === 'CHECKED') ?? []
  const carryOn = boxes?.filter((b) => b.shippingMethod === 'CARRY_ON') ?? []
  const getOwnerOptions = (owner?: Pick<User, 'id' | 'name'>) => [
    { value: '', label: '— 未指定 —' },
    ...(owner && !users?.some((u) => u.id === owner.id)
      ? [{ value: owner.id, label: owner.name }]
      : []),
    ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
  ]

  const BoxCard = ({ box }: { box: typeof boxes extends (infer T)[] | undefined ? T : never }) => (
    <div className="card group flex min-h-[13rem] flex-col gap-5 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <Link to="/boxes/$id" params={{ id: box!.id }} className="min-w-0 flex-1">
          <span className="block truncate text-2xl font-bold text-app">{box!.label}</span>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Package className="h-4 w-4" />
              {box!.itemCount ?? 0} 件物品
            </span>
            {(box!.totalWeightG ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Weight className="h-4 w-4" />
                {(box!.totalWeightG! / 1000).toFixed(2).replace(/\.?0+$/, '')} kg
              </span>
            )}
          </div>
        </Link>
        {isAdmin
          ? <Select
              value={box!.status}
              onChange={(v) => updateBox.mutate({
                id: box!.id,
                data: { status: v as PackingStatus },
              })}
              triggerClassName={cn('badge shrink-0 cursor-pointer border-0 px-3 py-1.5 text-sm shadow-sm', STATUS_COLORS[box!.status])}
              options={STATUS_OPTIONS}
            />
          : <span className={cn('badge', STATUS_COLORS[box!.status])}>
              {STATUS_LABELS[box!.status]}
            </span>
        }
      </div>

      <div className="mt-auto border-t border-black/10 pt-4 dark:border-white/10">
        {isAdmin ? (
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <UserRound className="h-3.5 w-3.5" />
                負責人
              </span>
              <Select
                className="min-w-0"
                value={box!.ownerId ?? ''}
                onChange={(v) => updateBox.mutate({
                  id: box!.id,
                  data: { ownerId: v || null },
                })}
                options={getOwnerOptions(box!.owner)}
              />
            </div>
            <button
              type="button"
              aria-label={`刪除箱子 ${box!.label}`}
              title="刪除箱子"
              onClick={() => { if (confirm(`確定刪除箱子「${box!.label}」？`)) deleteBox.mutate(box!.id) }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 text-muted transition-colors hover:border-brand-500/30 hover:bg-brand-500/10 hover:text-brand-500 dark:border-white/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : box!.owner ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <UserRound className="h-4 w-4" />
            負責人: {box!.owner.name}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <UserRound className="h-4 w-4" />
            尚未指定負責人
          </p>
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
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-muted">託運箱</h2>
                <span className="badge bg-black/5 text-muted dark:bg-white/10">{checked.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {checked.map((b) => <BoxCard key={b.id} box={b} />)}
              </div>
            </section>
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-muted">登機箱</h2>
                <span className="badge bg-black/5 text-muted dark:bg-white/10">{carryOn.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
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
