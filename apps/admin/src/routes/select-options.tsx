import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
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
  onSave,
  onDelete,
}: {
  opt: SelectOption
  onSave: (id: string, label: string, sortOrder: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(opt.label)
  const [sortOrder, setSortOrder] = useState(opt.sortOrder)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(opt.id, label, sortOrder)
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setLabel(opt.label)
    setSortOrder(opt.sortOrder)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-white/5">
        <td className="px-4 py-2 font-mono text-sm text-muted">{opt.value}</td>
        <td className="px-4 py-2">
          <input
            className="input py-1.5 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </td>
        <td className="px-4 py-2 w-24">
          <input
            type="number"
            className="input py-1.5 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
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
      <td className="px-4 py-3 font-mono text-sm text-muted">{opt.value}</td>
      <td className="px-4 py-3 font-medium">{opt.label}</td>
      <td className="px-4 py-3 text-muted">{opt.sortOrder}</td>
      <td className="px-4 py-3">
        <div className="flex gap-3">
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
  onAdd,
}: {
  type: SelectOptionType
  onAdd: () => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!value.trim() || !label.trim()) { setError('value 與顯示名稱為必填'); return }
    setSaving(true)
    setError('')
    try {
      await adminApi.createSelectOption({ type, value: value.trim(), label: label.trim(), sortOrder })
      setValue(''); setLabel(''); setSortOrder(0)
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
        <td colSpan={4} className="px-4 py-2">
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
        <input className="input py-1.5 text-sm font-mono" placeholder="VALUE_KEY" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </td>
      <td className="px-4 py-2">
        <input className="input py-1.5 text-sm" placeholder="顯示名稱" value={label} onChange={(e) => setLabel(e.target.value)} />
      </td>
      <td className="px-4 py-2 w-24">
        <input type="number" className="input py-1.5 text-sm" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="btn-primary px-3 py-1.5 text-xs">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5 text-xs">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="text-xs text-brand-600">{error}</p>}
        </div>
      </td>
    </tr>
  )
}

function SelectOptionsPage() {
  const [options, setOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)

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

  const handleSave = async (id: string, label: string, sortOrder: number) => {
    await adminApi.updateSelectOption(id, { label, sortOrder })
    await load()
  }

  const handleDelete = async (id: string) => {
    await adminApi.deleteSelectOption(id)
    await load()
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
          const typeOptions = options.filter((o) => o.type === type)
          return (
            <div key={type} className="card overflow-hidden">
              <div className="border-b border-white/10 px-5 py-3">
                <h2 className="font-bold text-app">{TYPE_LABELS[type]}</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    {['Value (程式碼)', '顯示名稱', '排序', ''].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {typeOptions.map((opt) => (
                    <OptionRow key={opt.id} opt={opt} onSave={handleSave} onDelete={handleDelete} />
                  ))}
                  <AddOptionRow type={type} onAdd={load} />
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
