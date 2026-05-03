import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, X, AlertTriangle, Pencil, Check, XCircle } from 'lucide-react'
import { useToast } from '@packman/ui'
import { batteriesApi, batteryRegulationsApi, usersApi, selectOptionsApi } from '../lib/api'
import { getLabelFromOptions, formatApiError } from '../lib/utils'
import { Select, SelectController } from '../lib/select'
import { useAuth } from '../lib/auth-context'
import { useT } from '../lib/i18n'
import type { CreateBatteryInput, UpdateBatteryInput, SelectOption } from '@packman/shared'

const BATTERY_COLORS: Record<string, string> = {
  POWER_TOOL: 'bg-red-500/10 text-brand-600 ring-1 ring-red-500/15',
  POWER_BANK: 'bg-black/10 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-white',
  LIFEPO4: 'bg-black text-white dark:bg-white dark:text-black',
}

function BatteryRegulations() {
  const t = useT()
  const { data: regulations } = useQuery({
    queryKey: ['battery-regulations'],
    queryFn: batteryRegulationsApi.list,
  })

  return (
    <div className="card border-brand-500/20 bg-brand-500/10 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-brand-600">
        <AlertTriangle className="h-5 w-5" />
        {t('batteries.regulations')}
      </div>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        {(regulations ?? []).map((regulation) => (
          <div key={regulation.id}>
            <h3 className="mb-2 font-medium text-app">{regulation.title}</h3>
            <ul className="list-disc space-y-1 pl-4 text-muted">
              {regulation.content.split('\n').filter(Boolean).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function NewBatteryModal({ onClose, batteryTypeOpts }: { onClose: () => void; batteryTypeOpts: SelectOption[] }) {
  const t = useT()
  const qc = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { register, handleSubmit, control } = useForm<CreateBatteryInput>()

  const create = useMutation({
    mutationFn: batteriesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['batteries'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('batteries.new.title')}</h2>
          <button onClick={onClose} className="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit((d) => create.mutate(d))}>
          <div>
            <label className="label">{t('batteries.new.batteryId')}</label>
            <input className="input mt-1" placeholder={t('batteries.new.batteryIdPlaceholder')} {...register('batteryId', { required: true })} />
          </div>
          <div>
            <label className="label">{t('batteries.new.type')}</label>
            <SelectController
              name="batteryType"
              control={control}
              className="mt-1"
              placeholder={t('common.placeholder.select')}
              options={batteryTypeOpts.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
          <div>
            <label className="label">{t('batteries.new.owner')}</label>
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
            <label className="label">{t('batteries.new.notes')}</label>
            <input className="input mt-1" {...register('notes')} />
          </div>
          {create.isError && (
            <p className="text-sm text-red-500">{formatApiError(create.error, t('common.opFailed'), t('common.requiredHint'))}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>{t('batteries.new.submit')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BatteryRow({
  b,
  users,
  batteryTypeOpts,
  onDelete,
}: {
  b: NonNullable<ReturnType<typeof useQuery<any>>['data']>[number]
  users: { id: string; name: string; avatarUrl?: string | null }[] | undefined
  batteryTypeOpts: SelectOption[]
  onDelete?: (id: string) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const { control, handleSubmit, reset, register } = useForm<UpdateBatteryInput>({
    defaultValues: {
      batteryType: b.batteryType,
      ownerId: b.ownerId ?? undefined,
      notes: b.notes ?? undefined,
    },
  })

  const update = useMutation({
    mutationFn: (data: UpdateBatteryInput) => batteriesApi.update(b.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batteries'] })
      setEditing(false)
      showToast(t('batteries.action.updated'), 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error'),
  })

  if (editing) {
    return (
      <tr className="bg-white/5">
        <td className="px-4 py-3 font-mono font-medium">{b.batteryId}</td>
        <td className="px-4 py-2">
          <SelectController
            name="batteryType"
            control={control}
            options={batteryTypeOpts.map((o) => ({ value: o.value, label: o.label }))}
          />
        </td>
        <td className="px-4 py-2">
          <SelectController
            name="ownerId"
            control={control}
            placeholder={t('common.placeholder.select')}
            emptyValue="null"
            options={[
              { value: '', label: t('batteries.row.empty') },
              ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
            ]}
          />
        </td>
        <td className="px-4 py-2" colSpan={2}>
          <div className="flex items-center gap-2">
            <input className="input" placeholder={t('batteries.row.notesPlaceholder')} {...register('notes')} />
            <button
              type="button"
              className="btn-primary px-3 py-2"
              onClick={handleSubmit((data) => update.mutate(data))}
              disabled={update.isPending}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              onClick={() => { reset(); setEditing(false) }}
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-black/5 dark:hover:bg-white/5">
      <td className="px-4 py-3 font-mono font-medium">{b.batteryId}</td>
      <td className="px-4 py-3">
        <span className={`badge ${BATTERY_COLORS[b.batteryType] ?? 'bg-white/10 text-app ring-1 ring-white/10'}`}>
          {getLabelFromOptions(batteryTypeOpts, b.batteryType)}
        </span>
      </td>
      <td className="px-4 py-3">
        {b.owner
          ? <span className="flex items-center gap-1">
              {b.owner.avatarUrl && <img src={b.owner.avatarUrl} className="h-5 w-5 rounded-full" alt="" />}
              {b.owner.name}
            </span>
          : '—'}
      </td>
      <td className="px-4 py-3 text-muted">{b.notes ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            className="text-muted hover:text-app"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {onDelete && (
            <button
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              onClick={() => { if (confirm(t('batteries.deleteConfirm'))) onDelete(b.id) }}
            >
              {t('common.delete')}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function BatteriesPage() {
  const t = useT()
  const [showNew, setShowNew] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const { data: batteries, isLoading } = useQuery({
    queryKey: ['batteries', typeFilter],
    queryFn: () => batteriesApi.list(typeFilter || undefined),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: batteryTypeOpts = [] } = useQuery({ queryKey: ['options', 'BATTERY_TYPE'], queryFn: () => selectOptionsApi.list('BATTERY_TYPE') })

  const deleteBattery = useMutation({
    mutationFn: batteriesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batteries'] })
      showToast(t('batteries.action.deleted'), 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error'),
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('batteries.title')}</h1>
          <p className="page-subtitle">{t('batteries.subtitle')}</p>
        </div>
        <button className="btn-primary gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> {t('batteries.add')}
        </button>
      </div>

      <BatteryRegulations />

      <div className="card table-shell">
        <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <span className="font-semibold">{t('batteries.list', { n: batteries?.length ?? 0 })}</span>
          <Select
            className="w-full sm:w-48"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: '', label: t('batteries.filter.allTypes') },
              ...batteryTypeOpts.map((o) => ({ value: o.value, label: o.label })),
            ]}
          />
        </div>
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <tr>
              {[
                t('batteries.col.id'),
                t('batteries.col.type'),
                t('batteries.col.owner'),
                t('batteries.col.notes'),
                '',
              ].map((h, idx) => (
                <th key={h || `empty-${idx}`} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-white/10" /></td>
                    ))}
                  </tr>
                ))
              : batteries?.map((b) => (
                  <BatteryRow
                    key={b.id}
                    b={b}
                    users={users}
                    batteryTypeOpts={batteryTypeOpts}
                    onDelete={isAdmin ? (id) => deleteBattery.mutate(id) : undefined}
                  />
                ))
            }
          </tbody>
        </table>
        </div>
      </div>

      {showNew && <NewBatteryModal onClose={() => setShowNew(false)} batteryTypeOpts={batteryTypeOpts} />}
    </div>
  )
}

export const Route = createFileRoute('/batteries')({ component: BatteriesPage })
