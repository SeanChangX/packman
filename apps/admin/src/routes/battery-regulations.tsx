import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Pencil, Plus, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import type { BatteryRegulation } from '@packman/shared'

function BatteryRegulationsPage() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [editing, setEditing] = useState<BatteryRegulation | null>(null)
  const { register, handleSubmit, reset } = useForm<{ title: string; content: string }>()
  const { data: regulations } = useQuery({ queryKey: ['admin-battery-regulations'], queryFn: adminApi.batteryRegulations })

  const create = useMutation({
    mutationFn: (data: { title: string; content: string }) => {
      const maxOrder = regulations?.reduce((m, r) => Math.max(m, r.sortOrder), -1) ?? -1
      return adminApi.createBatteryRegulation({ ...data, sortOrder: maxOrder + 1 })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-battery-regulations'] })
      reset({ title: '', content: '' })
      showToast('電池規定已新增', 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '電池規定新增失敗', 'error'),
  })

  const update = useMutation({
    mutationFn: (data: { title: string; content: string }) => {
      if (!editing) throw new Error()
      return adminApi.updateBatteryRegulation(editing.id, { ...data, sortOrder: editing.sortOrder })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-battery-regulations'] })
      setEditing(null)
      reset({ title: '', content: '' })
      showToast('電池規定已更新', 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '電池規定更新失敗', 'error'),
  })

  const del = useMutation({
    mutationFn: adminApi.deleteBatteryRegulation,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-battery-regulations'] }); showToast('電池規定已刪除', 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '電池規定刪除失敗', 'error'),
  })

  const move = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const sorted = [...(regulations ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
      const idx = sorted.findIndex((r) => r.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return
      const a = sorted[idx], b = sorted[swapIdx]
      await Promise.all([
        adminApi.updateBatteryRegulation(a.id, { sortOrder: b.sortOrder }),
        adminApi.updateBatteryRegulation(b.id, { sortOrder: a.sortOrder }),
      ])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-battery-regulations'] }),
    onError: (e: unknown) => showToast((e as Error)?.message ?? '排序更新失敗', 'error'),
  })

  const startEdit = (regulation: BatteryRegulation) => {
    setEditing(regulation)
    reset({ title: regulation.title, content: regulation.content })
  }

  const cancelEdit = () => {
    setEditing(null)
    reset({ title: '', content: '' })
  }

  const sorted = [...(regulations ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">電池規定</h1>
          <p className="page-subtitle">前台電池提醒內容，可新增多組規定</p>
        </div>
      </div>

      <form
        className="card grid gap-3 p-4 lg:grid-cols-[1fr_auto]"
        onSubmit={handleSubmit((data) => (editing ? update.mutate(data) : create.mutate(data)))}
      >
        <input className="input" placeholder="標題，例如：台灣出入境鋰電池規定" {...register('title', { required: true })} />
        <div className="flex gap-2">
          {editing && (
            <button type="button" className="btn-secondary px-3" onClick={cancelEdit}>
              <X className="h-4 w-4" />
            </button>
          )}
          <button className="btn-primary" disabled={create.isPending || update.isPending}>
            {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? '儲存' : '新增'}
          </button>
        </div>
        <textarea
          className="input min-h-32 lg:col-span-2"
          placeholder="每行一條規定"
          {...register('content', { required: true })}
        />
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {sorted.map((regulation, idx) => (
          <div key={regulation.id} className="card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="font-bold">{regulation.title}</h2>
              <div className="flex shrink-0 gap-1">
                <button
                  className="btn-secondary px-2"
                  disabled={idx === 0 || move.isPending}
                  onClick={() => move.mutate({ id: regulation.id, direction: 'up' })}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  className="btn-secondary px-2"
                  disabled={idx === sorted.length - 1 || move.isPending}
                  onClick={() => move.mutate({ id: regulation.id, direction: 'down' })}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button className="btn-secondary px-3" onClick={() => startEdit(regulation)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  className="btn-danger px-3"
                  onClick={() => { if (confirm(`刪除 ${regulation.title}？`)) del.mutate(regulation.id) }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {regulation.content.split('\n').filter(Boolean).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/battery-regulations')({ component: BatteryRegulationsPage })
