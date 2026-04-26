import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { adminApi } from '../lib/api'
import type { BatteryRegulation } from '@packman/shared'

function BatteryRegulationsPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<BatteryRegulation | null>(null)
  const { register, handleSubmit, reset } = useForm<{ title: string; content: string; sortOrder: number }>({
    defaultValues: { sortOrder: 0 },
  })
  const { data: regulations } = useQuery({ queryKey: ['admin-battery-regulations'], queryFn: adminApi.batteryRegulations })

  const create = useMutation({
    mutationFn: adminApi.createBatteryRegulation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-battery-regulations'] })
      reset({ title: '', content: '', sortOrder: 0 })
    },
  })

  const update = useMutation({
    mutationFn: (data: { title: string; content: string; sortOrder: number }) => {
      if (!editing) throw new Error('沒有正在編輯的規定')
      return adminApi.updateBatteryRegulation(editing.id, data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-battery-regulations'] })
      setEditing(null)
      reset({ title: '', content: '', sortOrder: 0 })
    },
  })

  const del = useMutation({
    mutationFn: adminApi.deleteBatteryRegulation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-battery-regulations'] }),
  })

  const startEdit = (regulation: BatteryRegulation) => {
    setEditing(regulation)
    reset({
      title: regulation.title,
      content: regulation.content,
      sortOrder: regulation.sortOrder,
    })
  }

  const cancelEdit = () => {
    setEditing(null)
    reset({ title: '', content: '', sortOrder: 0 })
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">電池規定</h1>
          <p className="page-subtitle">前台電池提醒內容，可新增多組規定</p>
        </div>
      </div>

      <form
        className="card grid gap-3 p-4 lg:grid-cols-[1fr_7rem_auto]"
        onSubmit={handleSubmit((data) => (editing ? update.mutate(data) : create.mutate(data)))}
      >
        <input className="input" placeholder="標題，例如：台灣出入境鋰電池規定" {...register('title', { required: true })} />
        <input className="input" type="number" placeholder="排序" {...register('sortOrder', { valueAsNumber: true })} />
        <div className="flex gap-2">
          {editing && (
            <button type="button" className="btn-secondary px-3" onClick={cancelEdit}>
              <X className="h-4 w-4" />
            </button>
          )}
          <button className="btn-primary flex-1" disabled={create.isPending || update.isPending}>
            {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? '儲存' : '新增'}
          </button>
        </div>
        <textarea
          className="input min-h-32 lg:col-span-3"
          placeholder="每行一條規定"
          {...register('content', { required: true })}
        />
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {regulations?.map((regulation) => (
          <div key={regulation.id} className="card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{regulation.title}</h2>
                <p className="text-xs text-muted">排序 {regulation.sortOrder}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary px-3" onClick={() => startEdit(regulation)}>
                  <Pencil className="h-4 w-4" /> 編輯
                </button>
                <button
                  className="btn-danger px-3"
                  onClick={() => { if (confirm(`刪除 ${regulation.title}？`)) del.mutate(regulation.id) }}
                >
                  <Trash2 className="h-4 w-4" /> 刪除
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
