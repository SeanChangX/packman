import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { adminApi } from '../lib/api'

const PRESET_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#A855F7', // purple
  '#EC4899', // pink
]

function GroupModal({ initial, onClose }: { initial?: { id: string; name: string; color: string }; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: { name: initial?.name ?? '', color: initial?.color ?? '#EF4444' },
  })
  const color = watch('color')

  const save = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      initial ? adminApi.updateGroup(initial.id, data) : adminApi.createGroup(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-groups'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{initial ? '編輯組別' : '新增組別'}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit((d) => save.mutate(d))}>
          <div>
            <label className="label">組別名稱</label>
            <input className="input mt-1" {...register('name', { required: true })} />
          </div>
          <div>
            <label className="label">顏色</label>
            <div className="mt-2 flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-6 w-6 shrink-0 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'scale-110 border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setValue('color', c)}
                />
              ))}
            </div>
            <div className="mt-2 flex w-36 overflow-hidden rounded-lg border border-white/10">
              <span className="h-9 w-9 shrink-0" style={{ backgroundColor: color }} />
              <input
                type="text"
                value={color.toUpperCase()}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setValue('color', v.toLowerCase())
                }}
                className="w-full bg-transparent px-2 font-mono text-xs focus:outline-none"
                placeholder="#000000"
                maxLength={7}
                spellCheck={false}
              />
            </div>
          </div>
          {save.isError && (
            <p className="text-sm text-red-500">{(save.error as Error).message}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>儲存</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GroupsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ id?: string; name?: string; color?: string } | null>(null)
  const { data: groups, isLoading } = useQuery({ queryKey: ['admin-groups'], queryFn: adminApi.groups })

  const del = useMutation({
    mutationFn: adminApi.deleteGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-groups'] }),
  })

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">組別管理</h1>
          <p className="page-subtitle">團隊分類與標籤色彩</p>
        </div>
        <button className="btn-primary gap-1" onClick={() => setModal({})}>
          <Plus className="h-4 w-4" /> 新增組別
        </button>
      </div>

      <div className="card table-shell">
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <tr>
              {['組別', '顏色', '操作'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={3} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-white/10" /></td></tr>)
              : groups?.map((g) => (
                  <tr key={g.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span className="badge" style={{ backgroundColor: g.color + '20', color: g.color }}>
                        {g.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: g.color }} />
                        <code className="text-xs text-muted">{g.color}</code>
                      </div>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button className="btn-secondary px-2 py-1 text-xs gap-1" onClick={() => setModal(g)}>
                        <Pencil className="h-3 w-3" /> 編輯
                      </button>
                      <button
                        className="btn-danger px-2 py-1 text-xs gap-1"
                        onClick={() => { if (confirm(`確定刪除組別 ${g.name}？`)) del.mutate(g.id) }}
                      >
                        <Trash2 className="h-3 w-3" /> 刪除
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        </div>
      </div>

      {modal !== null && (
        <GroupModal
          initial={modal.id ? modal as any : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export const Route = createFileRoute('/groups')({ component: GroupsPage })
