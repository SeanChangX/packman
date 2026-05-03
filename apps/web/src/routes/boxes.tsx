import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Package, Plus, Trash2, UserRound, Weight, X } from 'lucide-react'
import { useToast } from '@packman/ui'
import { boxesApi, usersApi } from '../lib/api'
import { STATUS_LABEL_KEYS, STATUS_COLORS, cn, formatApiError } from '../lib/utils'
import { Select, SelectController } from '../lib/select'
import { useT } from '../lib/i18n'
import type { CreateBoxInput, PackingStatus, UpdateBoxInput, User } from '@packman/shared'
import { useAuth } from '../lib/auth-context'

function NewBoxModal({ onClose }: { onClose: () => void }) {
  const t = useT()
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
          <h2 className="text-lg font-bold">{t('boxes.new.title')}</h2>
          <button onClick={onClose} className="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit((d) => create.mutate(d))}>
          <div>
            <label className="label">{t('boxes.new.label')}</label>
            <input className="input mt-1" placeholder={t('boxes.new.labelPlaceholder')} {...register('label', { required: true })} />
          </div>
          <div>
            <label className="label">{t('boxes.new.shipping')}</label>
            <SelectController
              name="shippingMethod"
              control={control}
              className="mt-1"
              placeholder={t('common.placeholder.select')}
              options={[
                { value: 'CHECKED', label: t('shipping.CHECKED') },
                { value: 'CARRY_ON', label: t('shipping.CARRY_ON') },
              ]}
            />
          </div>
          <div>
            <label className="label">{t('boxes.new.owner')}</label>
            <SelectController
              name="ownerId"
              control={control}
              className="mt-1"
              placeholder={t('common.placeholder.select')}
              options={[
                { value: '', label: t('common.placeholder.select') },
                ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
              ]}
            />
          </div>
          <div>
            <label className="label">{t('boxes.new.notes')}</label>
            <input className="input mt-1" {...register('notes')} />
          </div>
          {create.isError && (
            <p className="text-sm text-red-500">{formatApiError(create.error, t('common.opFailed'), t('common.requiredHint'))}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>{t('boxes.new.submit')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BoxesPage() {
  const t = useT()
  const qc = useQueryClient()
  const { user } = useAuth()
  const { showToast } = useToast()
  const isAdmin = user?.role === 'ADMIN'
  const [showNew, setShowNew] = useState(false)
  const STATUS_OPTIONS = [
    { value: 'NOT_PACKED', label: t('status.NOT_PACKED') },
    { value: 'PACKED', label: t('status.PACKED') },
    { value: 'SEALED', label: t('status.SEALED') },
  ] as const
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
      showToast(t('boxes.action.deleted'), 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error'),
  })

  const updateBox = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBoxInput }) =>
      boxesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boxes'] }),
    onError: (e: unknown) => showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error'),
  })

  const checked = boxes?.filter((b) => b.shippingMethod === 'CHECKED') ?? []
  const carryOn = boxes?.filter((b) => b.shippingMethod === 'CARRY_ON') ?? []
  const getOwnerOptions = (owner?: Pick<User, 'id' | 'name'>) => [
    { value: '', label: t('common.placeholder.unassigned') },
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
              {t('boxes.itemCount', { n: box!.itemCount ?? 0 })}
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
              {t(STATUS_LABEL_KEYS[box!.status])}
            </span>
        }
      </div>

      <div className="mt-auto border-t border-black/10 pt-4 dark:border-white/10">
        {isAdmin ? (
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <UserRound className="h-3.5 w-3.5" />
                {t('boxes.owner')}
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
              aria-label={t('boxes.deleteAria', { label: box!.label })}
              title={t('boxes.deleteTitle')}
              onClick={() => { if (confirm(t('boxes.deleteConfirm', { label: box!.label }))) deleteBox.mutate(box!.id) }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 text-muted transition-colors hover:border-brand-500/30 hover:bg-brand-500/10 hover:text-brand-500 dark:border-white/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : box!.owner ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <UserRound className="h-4 w-4" />
            {t('boxes.ownerLabel', { name: box!.owner.name })}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <UserRound className="h-4 w-4" />
            {t('boxes.noOwner')}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('boxes.title')}</h1>
          <p className="page-subtitle">{t('boxes.subtitle')}</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="btn-primary gap-1" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> {t('boxes.add')}
          </button>
        )}
      </div>

      {isLoading
        ? <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        : (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-muted">{t('boxes.section.checked')}</h2>
                <span className="badge bg-black/5 text-muted dark:bg-white/10">{checked.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {checked.map((b) => <BoxCard key={b.id} box={b} />)}
              </div>
            </section>
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-muted">{t('boxes.section.carryOn')}</h2>
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
