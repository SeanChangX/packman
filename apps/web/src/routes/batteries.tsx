import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, X, AlertTriangle } from 'lucide-react'
import { batteriesApi, usersApi } from '../lib/api'
import { BATTERY_TYPE_LABELS } from '../lib/utils'
import type { CreateBatteryInput, BatteryType } from '@packman/shared'

const BATTERY_COLORS: Record<BatteryType, string> = {
  POWER_TOOL: 'bg-orange-100 text-orange-800',
  BEACON_CHARGER: 'bg-green-100 text-green-800',
  LIFEPO4: 'bg-purple-100 text-purple-800',
}

function BatteryRegulations() {
  return (
    <div className="card border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-amber-800">
        <AlertTriangle className="h-5 w-5" />
        電池航空規定提醒
      </div>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium text-gray-800">🇹🇼 台灣出入境 (CAA)</h3>
          <ul className="list-disc space-y-1 pl-4 text-gray-700">
            <li>鋰電池 <strong>禁止</strong> 放置於託運行李</li>
            <li>行動電源需攜帶登機，每人限帶 2 個</li>
            <li>≤100Wh：無限制（需過安檢）</li>
            <li>100–160Wh：每人限 2 個，需航空公司許可</li>
            <li>&gt;160Wh：<strong>禁止攜帶</strong></li>
            <li>工具機電池（18V Li-ion）：登機手提，注意Wh</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-medium text-gray-800">🇫🇷 法國入境 (DGAC)</h3>
          <ul className="list-disc space-y-1 pl-4 text-gray-700">
            <li>規定與 IATA 相同，鋰電池禁放託運</li>
            <li>≤100Wh：可隨身攜帶（建議申報）</li>
            <li>100–160Wh：每人最多 2 個，需航空公司批准</li>
            <li>磷酸鋰鐵電池（LiFePO4）：與一般鋰電池同規定</li>
            <li>建議提前聯繫航空公司取得書面許可</li>
            <li>電池端子需保護，避免短路</li>
          </ul>
        </div>
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
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">電池分配名單</h1>
        <button className="btn-primary gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> 新增電池
        </button>
      </div>

      <BatteryRegulations />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <span className="font-semibold">電池清單 ({batteries?.length ?? 0})</span>
          <select className="input w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
            <option value="">全部種類</option>
            <option value="POWER_TOOL">工具機電池</option>
            <option value="BEACON_CHARGER">Beacon行充</option>
            <option value="LIFEPO4">磁酸鋰鐵電池</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['電池編號', '種類', '負責人', '說明', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-gray-200" /></td>
                    ))}
                  </tr>
                ))
              : batteries?.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
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
                    <td className="px-4 py-3 text-gray-500">{b.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        className="text-xs text-red-500 hover:text-red-700"
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

      {showNew && <NewBatteryModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

export const Route = createFileRoute('/batteries')({ component: BatteriesPage })
