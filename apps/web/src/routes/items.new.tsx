import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { itemsApi, groupsApi, boxesApi, usersApi } from '../lib/api'
import type { CreateItemInput } from '@packman/shared'

function NewItemPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const { data: boxes } = useQuery({ queryKey: ['boxes'], queryFn: boxesApi.list })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  const { register, handleSubmit, formState: { errors } } = useForm<CreateItemInput>({
    defaultValues: { quantity: 1, tags: [] },
  })

  const create = useMutation({
    mutationFn: itemsApi.create,
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ['items'] })
      navigate({ to: '/items/$id', params: { id: item.id } })
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: '/items' })} className="btn-secondary p-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="page-title">新增物品</h1>
      </div>

      <form className="card space-y-4 p-6" onSubmit={handleSubmit((data) => create.mutate(data))}>
        <div>
          <label className="label">品項名稱 *</label>
          <input className="input mt-1" {...register('name', { required: true })} />
          {errors.name && <p className="mt-1 text-xs text-red-500">必填欄位</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">物品負責人</label>
            <select className="input mt-1" {...register('ownerId')}>
              <option value="">— 請選擇 —</option>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">物品組別</label>
            <select className="input mt-1" {...register('groupId')}>
              <option value="">— 請選擇 —</option>
              {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">運送方式</label>
            <select className="input mt-1" {...register('shippingMethod')}>
              <option value="">— 請選擇 —</option>
              <option value="CHECKED">託運</option>
              <option value="CARRY_ON">登機</option>
            </select>
          </div>
          <div>
            <label className="label">數量</label>
            <input type="number" min={1} className="input mt-1" {...register('quantity', { valueAsNumber: true })} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">指定箱子</label>
            <select className="input mt-1" {...register('boxId')}>
              <option value="">— 未指定 —</option>
              {boxes?.map((b) => <option key={b.id} value={b.id}>箱 {b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">物品用途分類</label>
            <select className="input mt-1" {...register('useCategory')}>
              <option value="">— 請選擇 —</option>
              <option value="HIGH_FREQ">高使用頻率</option>
              <option value="RETURN_ONLY">往返物品</option>
              <option value="ONE_WAY">單程物品</option>
              <option value="LOW_FREQ">低使用頻率</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">說明</label>
          <textarea className="input mt-1" rows={2} {...register('notes')} />
        </div>

        <div>
          <label className="label">須留意之處</label>
          <textarea className="input mt-1" rows={2} {...register('specialNotes')} />
        </div>

        {create.isError && (
          <p className="text-sm text-red-500">{(create.error as Error).message}</p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate({ to: '/items' })} className="btn-secondary">
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? '新增中...' : '新增物品'}
          </button>
        </div>
      </form>
    </div>
  )
}

export const Route = createFileRoute('/items/new')({ component: NewItemPage })
