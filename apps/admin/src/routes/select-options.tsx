import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, ChevronUp, ChevronDown } from 'lucide-react'
import { adminApi } from '../lib/api'
import type { SelectOption, SelectOptionType } from '@packman/shared'

const TYPE_LABELS: Record<SelectOptionType, string> = {
  SHIPPING_METHOD: '運送方式',
  USE_CATEGORY: '物品用途分類',
  BATTERY_TYPE: '電池種類',
}

const TYPES: SelectOptionType[] = ['SHIPPING_METHOD', 'USE_CATEGORY', 'BATTERY_TYPE']

function OptionRow({
  opt,
  idx,
  total,
  onSave,
  onDelete,
  onMove,
  moving,
}: {
  opt: SelectOption
  idx: number
  total: number
  onSave: (id: string, label: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>
  moving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(opt.label)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(opt.id, label)
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setLabel(opt.label)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-white/5">
        <td className="px-4 py-2">
          <input
            className="input py-1.5 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary px-3 py-1.5 text-xs">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleCancel} className="btn-secondary px-3 py-1.5 text-xs">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-white/5">
      <td className="px-4 py-3 font-medium">{opt.label}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            disabled={idx === 0 || moving}
            onClick={() => onMove(opt.id, 'up')}
            className="text-muted hover:text-app disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            disabled={idx === total - 1 || moving}
            onClick={() => onMove(opt.id, 'down')}
            className="text-muted hover:text-app disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button onClick={() => setEditing(true)} className="text-muted hover:text-app">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`確定刪除「${opt.label}」？`)) onDelete(opt.id) }}
            className="text-brand-600 hover:text-brand-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddOptionRow({
  type,
  maxOrder,
  onAdd,
}: {
  type: SelectOptionType
  maxOrder: number
  onAdd: () => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!label.trim()) { setError('顯示名稱為必填'); return }
    setSaving(true)
    setError('')
    try {
      await adminApi.createSelectOption({ type, label: label.trim(), sortOrder: maxOrder + 1 })
      setLabel('')
      setOpen(false)
      onAdd()
    } catch (e: any) {
      setError(e.message ?? '新增失敗')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={2} className="px-4 py-2">
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
            <Plus className="h-4 w-4" /> 新增選項
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-brand-500/5">
      <td className="px-4 py-2">
        <input
          className="input py-1.5 text-sm"
          placeholder="顯示名稱"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        {error && <p className="mt-1 text-xs text-brand-600">{error}</p>}
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <button onClick={handleAdd} disabled={saving} className="btn-primary px-3 py-1.5 text-xs">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setOpen(false); setLabel('') }} className="btn-secondary px-3 py-1.5 text-xs">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function SelectOptionsPage() {
  const [options, setOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminApi.selectOptions()
      setOptions(data)
    } finally {
      setLoading(false)
    }
  }

  useState(() => { load() })

  const handleSave = async (id: string, label: string) => {
    await adminApi.updateSelectOption(id, { label })
    await load()
  }

  const handleDelete = async (id: string) => {
    await adminApi.deleteSelectOption(id)
    await load()
  }

  const handleMove = async (type: SelectOptionType, id: string, direction: 'up' | 'down') => {
    const sorted = options.filter((o) => o.type === type).sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((o) => o.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[swapIdx]
    setMoving(true)
    try {
      await Promise.all([
        adminApi.updateSelectOption(a.id, { sortOrder: b.sortOrder }),
        adminApi.updateSelectOption(b.id, { sortOrder: a.sortOrder }),
      ])
      await load()
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">選項管理</h1>
          <p className="page-subtitle">管理下拉選單的選項，新增後立即在 App 生效</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        TYPES.map((type) => {
          const typeOptions = options
            .filter((o) => o.type === type)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          const maxOrder = typeOptions.reduce((m, o) => Math.max(m, o.sortOrder), -1)
          return (
            <div key={type} className="card overflow-hidden">
              <div className="border-b border-white/10 px-5 py-3">
                <h2 className="font-bold text-app">{TYPE_LABELS[type]}</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-muted">顯示名稱</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-muted w-40">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {typeOptions.map((opt, idx) => (
                    <OptionRow
                      key={opt.id}
                      opt={opt}
                      idx={idx}
                      total={typeOptions.length}
                      onSave={handleSave}
                      onDelete={handleDelete}
                      onMove={(id, dir) => handleMove(type, id, dir)}
                      moving={moving}
                    />
                  ))}
                  <AddOptionRow type={type} maxOrder={maxOrder} onAdd={load} />
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}

export const Route = createFileRoute('/select-options')({ component: SelectOptionsPage })
