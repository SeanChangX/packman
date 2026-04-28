import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { itemsApi, groupsApi, boxesApi, usersApi, selectOptionsApi } from '../lib/api'
import { SelectController } from '../lib/select'
import { optionsToSelectItems } from '../lib/utils'
import type { CreateItemInput } from '@packman/shared'

function NewItemPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const { data: boxes } = useQuery({ queryKey: ['boxes'], queryFn: () => boxesApi.list() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: shippingOpts } = useQuery({ queryKey: ['options', 'SHIPPING_METHOD'], queryFn: () => selectOptionsApi.list('SHIPPING_METHOD') })
  const { data: categoryOpts } = useQuery({ queryKey: ['options', 'USE_CATEGORY'], queryFn: () => selectOptionsApi.list('USE_CATEGORY') })

  const { register, handleSubmit, control, formState: { errors } } = useForm<CreateItemInput>({
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
        <button onClick={() => navigate({ to: '/items' })} className="rounded-2xl p-2 text-muted transition-colors hover:bg-white/10 hover:text-app">
          <ArrowLeft className="h-5 w-5" />
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
            <label className="label">物品組別</label>
            <SelectController
              name="groupId"
              control={control}
              className="mt-1"
              placeholder="— 請選擇 —"
              options={[
                { value: '', label: '— 請選擇 —' },
                ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? []),
              ]}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">運送方式</label>
            <SelectController
              name="shippingMethod"
              control={control}
              className="mt-1"
              placeholder="— 請選擇 —"
              options={optionsToSelectItems(shippingOpts ?? [])}
            />
          </div>
          <div>
            <label className="label">數量</label>
            <input type="number" min={1} className="input mt-1" {...register('quantity', { valueAsNumber: true })} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">指定箱子</label>
            <SelectController
              name="boxId"
              control={control}
              className="mt-1"
              placeholder="— 未指定 —"
              options={[
                { value: '', label: '— 未指定 —' },
                ...(boxes?.map((b) => ({ value: b.id, label: b.label })) ?? []),
              ]}
            />
          </div>
          <div>
            <label className="label">物品用途分類</label>
            <SelectController
              name="useCategory"
              control={control}
              className="mt-1"
              placeholder="— 請選擇 —"
              options={optionsToSelectItems(categoryOpts ?? [])}
            />
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

export const Route = createFileRoute('/items_/new')({ component: NewItemPage })
