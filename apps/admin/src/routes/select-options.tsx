import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { useT } from '../lib/i18n'
import type { SelectOption, SelectOptionType } from '@packman/shared'

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
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(opt.label)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(opt.id, label)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setLabel(opt.label)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-white/5">
        <td className="min-w-0 px-4 py-2">
          <input
            className="input py-1.5 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </td>
        <td className="w-36 px-4 py-2">
          <div className="flex justify-end gap-2">
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
      <td className="min-w-0 px-4 py-3 font-medium">
        <span className="block truncate">{opt.label}</span>
      </td>
      <td className="w-36 px-4 py-3">
        <div className="flex items-center justify-end gap-3">
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
            onClick={() => { if (confirm(t('selectOptions.delete.confirm', { label: opt.label }))) onDelete(opt.id) }}
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
  const t = useT()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!label.trim()) { setError(t('selectOptions.label.required')); return }
    setSaving(true)
    setError('')
    try {
      await adminApi.createSelectOption({ type, label: label.trim(), sortOrder: maxOrder + 1 })
      setLabel('')
      setOpen(false)
      onAdd()
    } catch (e: any) {
      setError(e.message ?? t('selectOptions.create.failed'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={2} className="px-4 py-2">
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
            <Plus className="h-4 w-4" /> {t('selectOptions.add')}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-brand-500/5">
      <td className="min-w-0 px-4 py-2">
        <input
          className="input py-1.5 text-sm"
          placeholder={t('selectOptions.placeholder.label')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        {error && <p className="mt-1 text-xs text-brand-600">{error}</p>}
      </td>
      <td className="w-36 px-4 py-2">
        <div className="flex justify-end gap-2">
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
  const t = useT()
  const TYPE_LABELS: Record<SelectOptionType, string> = {
    SHIPPING_METHOD: t('selectOptions.type.shippingMethod'),
    USE_CATEGORY: t('selectOptions.type.useCategory'),
    BATTERY_TYPE: t('selectOptions.type.batteryType'),
  }

  const qc = useQueryClient()
  const { showToast } = useToast()
  const { data: options = [], isLoading } = useQuery({
    queryKey: ['admin-select-options'],
    queryFn: adminApi.selectOptions,
  })

  const invalidateOptions = () => qc.invalidateQueries({ queryKey: ['admin-select-options'] })

  const updateOption = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      adminApi.updateSelectOption(id, { label }),
    onSuccess: () => { invalidateOptions(); showToast(t('selectOptions.update.saved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('selectOptions.update.failed'), 'error'),
  })

  const deleteOption = useMutation({
    mutationFn: adminApi.deleteSelectOption,
    onSuccess: () => { invalidateOptions(); showToast(t('selectOptions.delete.saved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('selectOptions.delete.failed'), 'error'),
  })

  const moveOption = useMutation({
    mutationFn: async ({ type, id, direction }: { type: SelectOptionType; id: string; direction: 'up' | 'down' }) => {
      const sorted = options.filter((o) => o.type === type).sort((a, b) => a.sortOrder - b.sortOrder)
      const idx = sorted.findIndex((o) => o.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return
      const a = sorted[idx], b = sorted[swapIdx]
      await Promise.all([
        adminApi.updateSelectOption(a.id, { sortOrder: b.sortOrder }),
        adminApi.updateSelectOption(b.id, { sortOrder: a.sortOrder }),
      ])
    },
    onSuccess: invalidateOptions,
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('selectOptions.sort.failed'), 'error'),
  })

  const handleSave = (id: string, label: string) =>
    updateOption.mutateAsync({ id, label }).then(() => undefined).catch(() => undefined)

  const handleDelete = (id: string) =>
    deleteOption.mutateAsync(id).then(() => undefined).catch(() => undefined)

  const handleMove = (type: SelectOptionType, id: string, direction: 'up' | 'down') =>
    moveOption.mutateAsync({ type, id, direction }).then(() => undefined).catch(() => undefined)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('selectOptions.title')}</h1>
          <p className="page-subtitle">{t('selectOptions.subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
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
              <table className="w-full min-w-0 table-fixed text-sm">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-muted">{t('selectOptions.column.label')}</th>
                    <th className="w-36 px-4 py-2 text-right text-xs font-semibold uppercase text-muted">{t('common.actions')}</th>
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
                      moving={moveOption.isPending}
                    />
                  ))}
                  <AddOptionRow type={type} maxOrder={maxOrder} onAdd={invalidateOptions} />
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
