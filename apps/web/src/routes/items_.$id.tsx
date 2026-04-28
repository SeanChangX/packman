import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Upload, QrCode, Tag, Trash2 } from 'lucide-react'
import { useToast } from '@packman/ui'
import { itemsApi, groupsApi, boxesApi, usersApi, selectOptionsApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, getLabelFromOptions, optionsToSelectItems, cn, formatApiError } from '../lib/utils'
import { SelectController } from '../lib/select'
import type { UpdateItemInput, PackingStatus } from '@packman/shared'

function ItemDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [tagsText, setTagsText] = useState('')

  const { data: item, refetch } = useQuery({
    queryKey: ['item', id],
    queryFn: () => itemsApi.get(id),
    refetchInterval: (q) =>
      q.state.data?.aiTagStatus === 'PENDING' ? 3000 : false,
  })
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const { data: boxes } = useQuery({ queryKey: ['boxes'], queryFn: () => boxesApi.list() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: shippingOpts } = useQuery({ queryKey: ['options', 'SHIPPING_METHOD'], queryFn: () => selectOptionsApi.list('SHIPPING_METHOD') })
  const { data: categoryOpts } = useQuery({ queryKey: ['options', 'USE_CATEGORY'], queryFn: () => selectOptionsApi.list('USE_CATEGORY') })

  const { register, handleSubmit, reset, control } = useForm<UpdateItemInput>()

  useEffect(() => {
    if (item) {
      reset({ ...item, groupId: item.groupId ?? undefined, boxId: item.boxId ?? undefined, ownerId: item.ownerId ?? undefined })
      setTagsText(item.tags.join(', '))
    }
  }, [item, reset])

  const parseTags = (value: string) =>
    [...new Set(
      value
        .split(/[,，、;\n]/)
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter((tag) => tag.length > 0 && tag.length <= 30)
    )].slice(0, 20)

  const update = useMutation({
    mutationFn: (data: UpdateItemInput) => itemsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item', id] })
      setEditing(false)
      showToast('物品已更新', 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
  })

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => itemsApi.uploadPhoto(id, file),
    onSuccess: () => refetch(),
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
  })

  const deleteItem = useMutation({
    mutationFn: () => itemsApi.delete(id),
    onSuccess: () => {
      showToast('物品已刪除', 'success')
      navigate({ to: '/items' })
    },
    onError: (e: unknown) => showToast(formatApiError(e), 'error'),
  })

  if (!item) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: '/items' })} className="rounded-2xl p-2 text-muted transition-colors hover:bg-white/10 hover:text-app">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{item.name}</h1>
          <div className="mt-1 flex gap-2">
            <span className={cn('badge', STATUS_COLORS[item.status])}>{STATUS_LABELS[item.status]}</span>
            {item.shippingMethod && <span className="badge bg-black/10 text-app dark:bg-white/10">{getLabelFromOptions(shippingOpts, item.shippingMethod)}</span>}
          </div>
        </div>
        <button
          onClick={() => { if (confirm(`確定刪除「${item.name}」？`)) deleteItem.mutate() }}
          className="rounded-2xl p-2 text-brand-500 transition-colors hover:bg-brand-500/10"
          title="刪除"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Photo + QR */}
        <div className="card space-y-4 p-4">
          <div className="aspect-video overflow-hidden rounded-[22px] bg-black/5 dark:bg-white/10">
            {item.photoUrl
              ? <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center text-muted">尚無照片</div>
            }
          </div>

          <div className="flex gap-2">
            <button
              className="btn-secondary w-full gap-1"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isPending}
            >
              <Upload className="h-4 w-4" />
              {uploadPhoto.isPending ? '上傳中...' : '上傳照片'}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadPhoto.mutate(f)
            }}
          />

          {/* AI Tags */}
          <div>
            <div className="flex items-center gap-1 text-sm font-semibold text-app">
              <Tag className="h-4 w-4" />
              <span>搜尋標籤</span>
              {item.aiTagStatus === 'PENDING' && (
                <span className="ml-1 animate-pulse text-xs text-brand-600">辨識中...</span>
              )}
              {item.aiTagStatus === 'FAILED' && (
                <span className="ml-1 text-xs text-red-500">辨識失敗</span>
              )}
            </div>
            {item.tags.length > 0
              ? <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((t) => <span key={t} className="badge bg-black/5 text-muted dark:bg-white/10">{t}</span>)}
                </div>
              : <p className="mt-1 text-xs text-muted">上傳照片後自動辨識，也可以手動新增</p>
            }
          </div>

          {/* QR preview */}
          <img src={itemsApi.qrUrl(id)} alt="QR code" className="mx-auto h-24 w-24 rounded" />
        </div>

        {/* Details / Edit */}
        <div className="card p-4">
          {editing
            ? (
              <form className="space-y-3" onSubmit={handleSubmit((data) => update.mutate({ ...data, tags: parseTags(tagsText) }))}>
                <div>
                  <label className="label">品項名稱</label>
                  <input className="input mt-1" {...register('name')} />
                </div>
                <div>
                  <label className="label">狀態</label>
                  <SelectController
                    name="status"
                    control={control}
                    className="mt-1"
                    options={[
                      { value: 'NOT_PACKED', label: '尚未裝箱' },
                      { value: 'PACKED', label: '已裝箱' },
                    ]}
                  />
                </div>
                <div>
                  <label className="label">負責人</label>
                  <SelectController
                    name="ownerId"
                    control={control}
                    className="mt-1"
                    placeholder="— 請選擇 —"
                    emptyValue="null"
                    options={[
                      { value: '', label: '— 請選擇 —' },
                      ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
                    ]}
                  />
                </div>
                <div>
                  <label className="label">組別</label>
                  <SelectController
                    name="groupId"
                    control={control}
                    className="mt-1"
                    placeholder="— 請選擇 —"
                    emptyValue="null"
                    options={[
                      { value: '', label: '— 請選擇 —' },
                      ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? []),
                    ]}
                  />
                </div>
                <div>
                  <label className="label">運送方式</label>
                  <SelectController
                    name="shippingMethod"
                    control={control}
                    className="mt-1"
                    placeholder="— 請選擇 —"
                    emptyValue="null"
                    options={optionsToSelectItems(shippingOpts ?? [])}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">數量</label>
                    <input type="number" min={1} className="input mt-1" {...register('quantity', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="label">指定箱子</label>
                    <SelectController
                      name="boxId"
                      control={control}
                      className="mt-1"
                      placeholder="— 未指定 —"
                      emptyValue="null"
                      options={[
                        { value: '', label: '— 未指定 —' },
                        ...(boxes?.map((b) => ({ value: b.id, label: b.label })) ?? []),
                      ]}
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
                <div>
                  <label className="label">用途分類</label>
                  <SelectController
                    name="useCategory"
                    control={control}
                    className="mt-1"
                    placeholder="— 請選擇 —"
                    emptyValue="null"
                    options={optionsToSelectItems(categoryOpts ?? [])}
                  />
                </div>
                <div>
                  <label className="label">搜尋標籤</label>
                  <textarea
                    className="input mt-1"
                    rows={2}
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="blue, metal, hex key, tool"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>取消</button>
                  <button type="submit" className="btn-primary" disabled={update.isPending}>儲存</button>
                </div>
              </form>
            )
            : (
              <dl className="space-y-3 text-sm">
                {[
                  ['負責人', item.owner?.name ?? '—'],
                  ['組別', item.group?.name ?? '—'],
                  ['數量', item.quantity],
                  ['運送方式', item.shippingMethod ? getLabelFromOptions(shippingOpts, item.shippingMethod) : '—'],
                  ['箱子', item.box?.label ?? '—'],
                  ['用途分類', item.useCategory ? getLabelFromOptions(categoryOpts, item.useCategory) : '—'],
                  ['說明', item.notes ?? '—'],
                  ['須留意之處', item.specialNotes ?? '—'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between">
                    <dt className="font-medium text-muted">{label}</dt>
                    <dd className="text-app">{value}</dd>
                  </div>
                ))}
                <button className="btn-secondary mt-4 w-full" onClick={() => setEditing(true)}>
                  編輯
                </button>
              </dl>
            )
          }
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/items_/$id')({ component: ItemDetailPage })
