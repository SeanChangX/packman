import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { ArrowLeft, Upload, X } from 'lucide-react'
import { useToast } from '@packman/ui'
import { itemsApi, groupsApi, boxesApi, usersApi, selectOptionsApi } from '../lib/api'
import { SelectController } from '../lib/select'
import { cn, formatApiError, optionsToSelectItems } from '../lib/utils'
import type { CreateItemInput } from '@packman/shared'

function NewItemPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast, updateToast, dismissToast } = useToast()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const { data: boxes } = useQuery({ queryKey: ['boxes'], queryFn: () => boxesApi.list() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: shippingOpts } = useQuery({ queryKey: ['options', 'SHIPPING_METHOD'], queryFn: () => selectOptionsApi.list('SHIPPING_METHOD') })
  const { data: categoryOpts } = useQuery({ queryKey: ['options', 'USE_CATEGORY'], queryFn: () => selectOptionsApi.list('USE_CATEGORY') })

  const { register, handleSubmit, control, formState: { errors } } = useForm<CreateItemInput>({
    defaultValues: { quantity: 1, tags: [] },
  })

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const create = useMutation({
    mutationFn: async (data: CreateItemInput) => {
      const item = await itemsApi.create(data)
      if (!photoFile) return { item }

      const toastId = showToast('上傳照片中… 0%', 'info', { sticky: true, progress: 0 })
      let serverPhase = false
      try {
        await itemsApi.uploadPhoto(item.id, photoFile, (loaded, total) => {
          const ratio = total ? loaded / total : 0
          if (ratio >= 1 && !serverPhase) {
            serverPhase = true
            updateToast(toastId, { message: '伺服器處理中…', progress: undefined, sticky: true })
          } else if (!serverPhase) {
            updateToast(toastId, {
              message: `上傳照片中… ${Math.floor(ratio * 100)}%`,
              progress: ratio,
            })
          }
        })
        dismissToast(toastId)
      } catch (error) {
        dismissToast(toastId)
        return { item, photoError: formatApiError(error) }
      }

      return { item }
    },
    onSuccess: ({ item, photoError }) => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['item', item.id] })
      if (photoError) showToast(`物品已新增，但照片上傳失敗：${photoError}`, 'error')
      navigate({ to: '/items/$id', params: { id: item.id } })
    },
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
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
          <label className="label">照片</label>
          <div className="mt-1 grid gap-3 sm:grid-cols-[11rem_1fr] sm:items-stretch">
            <div className="aspect-square overflow-hidden rounded-[22px] bg-black/5 p-2 dark:bg-white/10">
              {photoPreview
                ? <img src={photoPreview} alt={photoFile?.name ?? '物品照片預覽'} className="h-full w-full object-contain" />
                : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted">
                      <Upload className="h-6 w-6" />
                      <span>尚未選擇照片</span>
                    </div>
                  )}
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-2">
              <label className={cn('btn-secondary w-full cursor-pointer gap-2', create.isPending && 'pointer-events-none opacity-60')}>
                <Upload className="h-4 w-4" />
                {photoFile ? '更換照片' : '上傳照片'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={create.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setPhotoFile(file)
                  }}
                />
              </label>
              {photoFile && (
                <button
                  type="button"
                  className="btn-secondary w-full gap-2"
                  disabled={create.isPending}
                  onClick={() => setPhotoFile(null)}
                >
                  <X className="h-4 w-4" />
                  移除照片
                </button>
              )}
              <p className="text-xs text-muted">
                建立物品後會自動上傳照片並辨識搜尋標籤。
              </p>
              {photoFile && <p className="truncate text-xs text-muted">{photoFile.name}</p>}
            </div>
          </div>
        </div>

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
            <input
              type="number"
              min={1}
              max={9999}
              className="input mt-1"
              {...register('quantity', {
                valueAsNumber: true,
                min: 1,
                max: 9999,
              })}
            />
            <p className="mt-1 text-xs text-muted">可輸入 1-9999</p>
            {errors.quantity && <p className="mt-1 text-xs text-red-500">數量需介於 1-9999</p>}
          </div>
        </div>

        <div>
          <label className="label">重量（g）</label>
          <input
            type="number"
            min={1}
            max={1000000}
            className="input mt-1"
            placeholder="例: 250"
            {...register('weightG', {
              valueAsNumber: true,
              min: 1,
              max: 1000000,
              setValueAs: (v) => (v === '' || isNaN(Number(v)) ? null : Number(v)),
            })}
          />
          <p className="mt-1 text-xs text-muted">
            {photoFile ? '上傳照片後 AI 會自動估算，也可以手動填入' : '可手動填入，或上傳照片後讓 AI 自動估算'}
          </p>
          {errors.weightG && <p className="mt-1 text-xs text-red-500">重量需介於 1-1,000,000 g</p>}
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
            {create.isPending ? (photoFile ? '新增並上傳中...' : '新增中...') : '新增物品'}
          </button>
        </div>
      </form>
    </div>
  )
}

export const Route = createFileRoute('/items_/new')({ component: NewItemPage })
