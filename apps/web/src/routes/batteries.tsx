import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, X, AlertTriangle } from 'lucide-react'
import { batteriesApi, batteryRegulationsApi, usersApi } from '../lib/api'
import { BATTERY_TYPE_LABELS } from '../lib/utils'
import { Select } from '../lib/select'
import type { CreateBatteryInput, BatteryType } from '@packman/shared'

const BATTERY_COLORS: Record<BatteryType, string> = {
  POWER_TOOL: 'bg-red-500/10 text-brand-600 ring-1 ring-red-500/15',
  BEACON_CHARGER: 'bg-black/10 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-white',
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

function NewBatteryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { register, handleSubmit } = useForm<CreateBatteryInput>()

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
            <select className="input mt-1" {...register('batteryType', { required: true })}>
              <option value="">— 請選擇 —</option>
              <option value="POWER_TOOL">工具機電池</option>
              <option value="BEACON_CHARGER">Beacon行充</option>
              <option value="LIFEPO4">磁酸鋰鐵電池</option>
            </select>
          </div>
          <div>
            <label className="label">負責人</label>
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

function BatteriesPage() {
  const [showNew, setShowNew] = useState(false)
  const [typeFilter, setTypeFilter] = useState<BatteryType | ''>('')
  const qc = useQueryClient()

  const { data: batteries, isLoading } = useQuery({
    queryKey: ['batteries', typeFilter],
    queryFn: () => batteriesApi.list(typeFilter || undefined),
  })

  const deleteBattery = useMutation({
    mutationFn: batteriesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batteries'] }),
  })

  const byType: Record<string, typeof batteries> = {}
  batteries?.forEach((b) => {
    byType[b.batteryType] = [...(byType[b.batteryType] ?? []), b]
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
            onChange={(value) => setTypeFilter(value as BatteryType | '')}
            options={[
              { value: '', label: '全部種類' },
              { value: 'POWER_TOOL', label: '工具機電池' },
              { value: 'BEACON_CHARGER', label: 'Beacon行充' },
              { value: 'LIFEPO4', label: '磁酸鋰鐵電池' },
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
                      <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-gray-200" /></td>
                    ))}
                  </tr>
                ))
              : batteries?.map((b) => (
                  <tr key={b.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-mono font-medium">{b.batteryId}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${BATTERY_COLORS[b.batteryType]}`}>
                        {BATTERY_TYPE_LABELS[b.batteryType]}
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
                      <button
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        onClick={() => { if (confirm('確定刪除？')) deleteBattery.mutate(b.id) }}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        </div>
      </div>

      {showNew && <NewBatteryModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

export const Route = createFileRoute('/batteries')({ component: BatteriesPage })
