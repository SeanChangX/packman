import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, X, AlertTriangle, Pencil, Check, XCircle } from 'lucide-react'
import { batteriesApi, batteryRegulationsApi, usersApi, selectOptionsApi } from '../lib/api'
import { getLabelFromOptions, formatApiError } from '../lib/utils'
import { Select, SelectController } from '../lib/select'
import type { CreateBatteryInput, UpdateBatteryInput, SelectOption } from '@packman/shared'

const BATTERY_COLORS: Record<string, string> = {
  POWER_TOOL: 'bg-red-500/10 text-brand-600 ring-1 ring-red-500/15',
  POWER_BANK: 'bg-black/10 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-white',
  LIFEPO4: 'bg-black text-white dark:bg-white dark:text-black',
}

function BatteryRegulations() {
  const { data: regulations } = useQuery({
    queryKey: ['battery-regulations'],
    queryFn: batteryRegulationsApi.list,
  })

  return (
    <div className="card border-brand-500/20 bg-brand-500/10 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-brand-600">
        <AlertTriangle className="h-5 w-5" />
        電池航空規定提醒
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
          <h2 className="text-lg font-bold">新增電池</h2>
          <button onClick={onClose} className="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit((d) => create.mutate(d))}>
          <div>
            <label className="label">電池編號 *</label>
            <input className="input mt-1" placeholder="例: 18V-01-2024Q1" {...register('batteryId', { required: true })} />
          </div>
          <div>
            <label className="label">電池種類 *</label>
            <SelectController
              name="batteryType"
              control={control}
              className="mt-1"
              placeholder="— 請選擇 —"
              options={batteryTypeOpts.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
          <div>
            <label className="label">負責人</label>
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

function BatteryRow({
  b,
  users,
  batteryTypeOpts,
  onDelete,
}: {
  b: NonNullable<ReturnType<typeof useQuery<any>>['data']>[number]
  users: { id: string; name: string; avatarUrl?: string | null }[] | undefined
  batteryTypeOpts: SelectOption[]
  onDelete: (id: string) => void
}) {
  const qc = useQueryClient()
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['batteries'] }); setEditing(false) },
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
            placeholder="— 請選擇 —"
            options={[
              { value: '', label: '— 無 —' },
              ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
            ]}
          />
        </td>
        <td className="px-4 py-2" colSpan={2}>
          <div className="flex items-center gap-2">
            <input className="input" placeholder="說明" {...register('notes')} />
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
          <button
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            onClick={() => { if (confirm('確定刪除？')) onDelete(b.id) }}
          >
            刪除
          </button>
        </div>
      </td>
    </tr>
  )
}

function BatteriesPage() {
  const [showNew, setShowNew] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const qc = useQueryClient()

  const { data: batteries, isLoading } = useQuery({
    queryKey: ['batteries', typeFilter],
    queryFn: () => batteriesApi.list(typeFilter || undefined),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: batteryTypeOpts = [] } = useQuery({ queryKey: ['options', 'BATTERY_TYPE'], queryFn: () => selectOptionsApi.list('BATTERY_TYPE') })

  const deleteBattery = useMutation({
    mutationFn: batteriesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batteries'] }),
    onError: (e: unknown) => alert(formatApiError(e)),
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">電池分配</h1>
          <p className="page-subtitle">登機攜帶電池與負責人</p>
        </div>
        <button className="btn-primary gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> 新增電池
        </button>
      </div>

      <BatteryRegulations />

      <div className="card table-shell">
        <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <span className="font-semibold">電池清單 ({batteries?.length ?? 0})</span>
          <Select
            className="w-full sm:w-48"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: '', label: '全部種類' },
              ...batteryTypeOpts.map((o) => ({ value: o.value, label: o.label })),
            ]}
          />
        </div>
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <tr>
              {['電池編號', '種類', '負責人', '說明', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>
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
                    onDelete={(id) => deleteBattery.mutate(id)}
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
