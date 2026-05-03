import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, RefreshCw, Tag, Trash2, Upload, X } from 'lucide-react'
import { useToast } from '@packman/ui'
import { itemsApi, groupsApi, boxesApi, usersApi, selectOptionsApi } from '../lib/api'
import { STATUS_LABEL_KEYS, STATUS_COLORS, getLabelFromOptions, optionsToSelectItems, cn, formatApiError, formatTimestamp } from '../lib/utils'
import { SelectController } from '../lib/select'
import { useT } from '../lib/i18n'
import type { UpdateItemInput, PackingStatus } from '@packman/shared'

function ItemDetailPage() {
  const t = useT()
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast, updateToast, dismissToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [photoSrc, setPhotoSrc] = useState('')
  const [photoLoadError, setPhotoLoadError] = useState(false)

  const { data: item, refetch, isLoading, isError, error } = useQuery({
    queryKey: ['item', id],
    queryFn: () => itemsApi.get(id),
    retry: (failureCount, err) => ((err as { status?: number })?.status === 404 ? false : failureCount < 2),
    refetchInterval: (q) =>
      q.state.status !== 'error' && q.state.data?.aiTagStatus === 'PENDING' ? 3000 : false,
  })
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const { data: boxes } = useQuery({ queryKey: ['boxes'], queryFn: () => boxesApi.list() })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: shippingOpts } = useQuery({ queryKey: ['options', 'SHIPPING_METHOD'], queryFn: () => selectOptionsApi.list('SHIPPING_METHOD') })
  const { data: categoryOpts } = useQuery({ queryKey: ['options', 'USE_CATEGORY'], queryFn: () => selectOptionsApi.list('USE_CATEGORY') })

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UpdateItemInput>()

  useEffect(() => {
    if (item) {
      reset({ ...item, groupId: item.groupId ?? undefined, boxId: item.boxId ?? undefined, ownerId: item.ownerId ?? undefined })
      setTags(item.tags)
      setTagDraft('')
      setPhotoSrc(item.photoUrl ? itemsApi.photoUrl(id) : '')
      setPhotoLoadError(false)
    }
  }, [id, item, reset])

  const normalizeTag = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30)

  const addTag = (value: string) => {
    const tag = normalizeTag(value)
    if (!tag) return
    setTags((current) => current.includes(tag) ? current : [...current, tag].slice(0, 20))
    setTagDraft('')
  }

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((item) => item !== tag))
  }

  const update = useMutation({
    mutationFn: (data: UpdateItemInput) => itemsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item', id] })
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['boxes'] })
      setEditing(false)
      showToast(t('items.action.updated'), 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error'),
  })

  const uploadToastIdRef = useRef<number | null>(null)
  const uploadPhoto = useMutation({
    mutationFn: (file: File) => {
      uploadToastIdRef.current = showToast(t('items.upload.uploadingPct', { pct: 0 }), 'info', { sticky: true, progress: 0 })
      let serverPhase = false
      return itemsApi.uploadPhoto(id, file, (loaded, total) => {
        const tid = uploadToastIdRef.current
        if (tid === null) return
        const ratio = total ? loaded / total : 0
        if (ratio >= 1 && !serverPhase) {
          serverPhase = true
          updateToast(tid, { message: t('items.upload.serverProcessing'), progress: undefined, sticky: true })
        } else if (!serverPhase) {
          updateToast(tid, {
            message: t('items.upload.uploadingPct', { pct: Math.floor(ratio * 100) }),
            progress: ratio,
          })
        }
      })
    },
    onSuccess: () => {
      if (uploadToastIdRef.current !== null) {
        dismissToast(uploadToastIdRef.current)
        uploadToastIdRef.current = null
      }
      showToast(t('items.upload.success'), 'success')
      qc.invalidateQueries({ queryKey: ['items'] })
      refetch()
    },
    onError: (e: unknown) => {
      if (uploadToastIdRef.current !== null) {
        dismissToast(uploadToastIdRef.current)
        uploadToastIdRef.current = null
      }
      showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error')
    },
  })

  const reanalyzePhoto = useMutation({
    mutationFn: () => itemsApi.reanalyzePhoto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      refetch()
      showToast(t('items.action.queuedReanalyze'), 'success')
    },
    onError: (e: unknown) => showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error'),
  })

  const deleteItem = useMutation({
    mutationFn: () => itemsApi.delete(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['item', id] })
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['boxes'] })
      showToast(t('items.action.deleted'), 'success')
      navigate({ to: '/items' })
    },
    onError: (e: unknown) => showToast(formatApiError(e, t('common.opFailed'), t('common.requiredHint')), 'error'),
  })

  if (isError && (error as { status?: number })?.status === 404) {
    return <p className="py-12 text-center text-muted">{t('item.detail.notFound')}</p>
  }
  if (isError) {
    return <p className="py-12 text-center text-red-500">{formatApiError(error, t('common.opFailed'), t('common.requiredHint'))}</p>
  }
  if (isLoading || !item) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>

  const latestJob = item.aiTagJobs?.[0]
  const aiStatusLabel = (() => {
    if (item.aiTagStatus === 'PENDING') {
      if (latestJob?.status === 'RUNNING') return t('items.detail.aiRunning')
      if (latestJob?.status === 'QUEUED' && latestJob.attempts > 0) return t('items.detail.aiQueued', { attempts: latestJob.attempts, maxAttempts: latestJob.maxAttempts })
      return t('items.detail.aiPending')
    }
    if (item.aiTagStatus === 'FAILED') return t('items.detail.aiFailed')
    if (item.aiTagStatus === 'DONE') return t('items.detail.aiDone')
    return ''
  })()

  return (
    <div className="mx-auto max-w-3xl page-stack">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: '/items' })} className="rounded-2xl p-2 text-muted transition-colors hover:bg-white/10 hover:text-app">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{item.name}</h1>
          <div className="mt-1 flex gap-2">
            <span className={cn('badge', STATUS_COLORS[item.status])}>{t(STATUS_LABEL_KEYS[item.status])}</span>
            {item.shippingMethod && <span className="badge bg-black/10 text-app dark:bg-white/10">{getLabelFromOptions(shippingOpts, item.shippingMethod)}</span>}
          </div>
        </div>
        <button
          onClick={() => { if (confirm(t('items.detail.deleteConfirm', { name: item.name }))) deleteItem.mutate() }}
          className="rounded-2xl p-2 text-brand-500 transition-colors hover:bg-brand-500/10"
          title={t('items.detail.delete')}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Photo + QR */}
        <div className="card space-y-4 p-4">
          <div className="aspect-square overflow-hidden rounded-[22px] bg-black/5 p-2 dark:bg-white/10 sm:aspect-[4/3]">
            {photoSrc && !photoLoadError
              ? (
                <img
                  src={photoSrc}
                  alt={item.name}
                  className="h-full w-full object-contain"
                  onError={() => {
                    if (photoSrc !== item.photoUrl && item.photoUrl) {
                      setPhotoSrc(item.photoUrl)
                      return
                    }
                    setPhotoLoadError(true)
                  }}
                />
              )
              : <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
                  {photoLoadError ? t('items.detail.photoLoadFailed') : t('items.detail.noPhoto')}
                </div>
            }
          </div>

          <div className="flex gap-2">
            <button
              className="btn-secondary w-full gap-1"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isPending}
            >
              <Upload className="h-4 w-4" />
              {uploadPhoto.isPending ? t('items.detail.uploading') : t('items.detail.uploadPhoto')}
            </button>
            <button
              className="btn-secondary w-full gap-1"
              onClick={() => reanalyzePhoto.mutate()}
              disabled={!item.photoUrl || reanalyzePhoto.isPending}
            >
              <RefreshCw className={cn('h-4 w-4', reanalyzePhoto.isPending && 'animate-spin')} />
              {t('items.detail.reanalyze')}
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
              <span>{t('items.detail.searchTags')}</span>
              {aiStatusLabel && (
                <span className={cn(
                  'ml-1 text-xs',
                  item.aiTagStatus === 'PENDING' && 'animate-pulse text-brand-600',
                  item.aiTagStatus === 'FAILED' && 'text-red-500',
                  item.aiTagStatus === 'DONE' && 'text-muted',
                )}>
                  {aiStatusLabel}
                </span>
              )}
            </div>
            {item.tags.length > 0
              ? <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => <span key={tag} className="badge bg-black/5 text-muted dark:bg-white/10">{tag}</span>)}
                </div>
              : <p className="mt-1 text-xs text-muted">{t('items.detail.tagsHint')}</p>
            }
          </div>

          {/* QR preview */}
          <img src={itemsApi.qrUrl(id)} alt="QR code" className="mx-auto h-24 w-24 rounded" />
        </div>

        {/* Details / Edit */}
        <div className="card p-4">
          {editing
            ? (
              <form className="space-y-3" onSubmit={handleSubmit((data) => update.mutate({ ...data, tags }))}>
                <div>
                  <label className="label">{t('items.detail.name')}</label>
                  <input className="input mt-1" {...register('name')} />
                </div>
                <div>
                  <label className="label">{t('items.detail.status')}</label>
                  <SelectController
                    name="status"
                    control={control}
                    className="mt-1"
                    options={[
                      { value: 'NOT_PACKED', label: t('status.NOT_PACKED') },
                      { value: 'PACKED', label: t('status.PACKED') },
                    ]}
                  />
                </div>
                <div>
                  <label className="label">{t('items.detail.owner')}</label>
                  <SelectController
                    name="ownerId"
                    control={control}
                    className="mt-1"
                    placeholder={t('common.placeholder.select')}
                    emptyValue="null"
                    options={[
                      { value: '', label: t('common.placeholder.select') },
                      ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
                    ]}
                  />
                </div>
                <div>
                  <label className="label">{t('items.detail.group')}</label>
                  <SelectController
                    name="groupId"
                    control={control}
                    className="mt-1"
                    placeholder={t('common.placeholder.select')}
                    emptyValue="null"
                    options={[
                      { value: '', label: t('common.placeholder.select') },
                      ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? []),
                    ]}
                  />
                </div>
                <div>
                  <label className="label">{t('items.detail.shipping')}</label>
                  <SelectController
                    name="shippingMethod"
                    control={control}
                    className="mt-1"
                    placeholder={t('common.placeholder.select')}
                    emptyValue="null"
                    options={optionsToSelectItems(shippingOpts ?? [])}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">{t('items.detail.quantity')}</label>
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
                  <p className="mt-1 text-xs text-muted">{t('items.new.qtyHint')}</p>
                  {errors.quantity && <p className="mt-1 text-xs text-red-500">{t('items.new.qtyError')}</p>}
                  </div>
                  <div>
                    <label className="label">{t('items.detail.weight')}</label>
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      className="input mt-1"
                      placeholder={t('items.new.weightPlaceholder')}
                      {...register('weightG', {
                        valueAsNumber: true,
                        min: 1,
                        max: 1000000,
                        setValueAs: (v) => (v === '' || isNaN(Number(v)) ? null : Number(v)),
                      })}
                    />
                    {errors.weightG && <p className="mt-1 text-xs text-red-500">{t('items.new.weightError')}</p>}
                  </div>
                </div>
                <div>
                    <label className="label">{t('items.detail.box')}</label>
                    <SelectController
                      name="boxId"
                      control={control}
                      className="mt-1"
                      placeholder={t('items.new.placeholderUnassigned')}
                      emptyValue="null"
                      options={[
                        { value: '', label: t('items.new.placeholderUnassigned') },
                        ...(boxes?.map((b) => ({ value: b.id, label: b.label })) ?? []),
                      ]}
                    />
                </div>
                <div>
                  <label className="label">{t('items.detail.notes')}</label>
                  <textarea className="input mt-1" rows={2} {...register('notes')} />
                </div>
                <div>
                  <label className="label">{t('items.detail.specialNotes')}</label>
                  <textarea className="input mt-1" rows={2} {...register('specialNotes')} />
                </div>
                <div>
                  <label className="label">{t('items.detail.useCategory')}</label>
                  <SelectController
                    name="useCategory"
                    control={control}
                    className="mt-1"
                    placeholder={t('common.placeholder.select')}
                    emptyValue="null"
                    options={optionsToSelectItems(categoryOpts ?? [])}
                  />
                </div>
                <div>
                  <label className="label">{t('items.detail.searchTags')}</label>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-black/5 p-2 dark:bg-white/5">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="badge max-w-full gap-1 bg-black/5 text-muted hover:bg-brand-500/10 hover:text-brand-600 dark:bg-white/10"
                        onClick={() => removeTag(tag)}
                      >
                        <span className="max-w-32 truncate">{tag}</span>
                        <X className="h-3 w-3 shrink-0" />
                      </button>
                    ))}
                    <input
                      className="min-h-8 min-w-full flex-1 basis-full bg-transparent px-2 text-sm text-app outline-none sm:min-w-48 sm:basis-48"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          addTag(tagDraft)
                        }
                        if (e.key === 'Backspace' && !tagDraft && tags.length > 0) {
                          removeTag(tags[tags.length - 1])
                        }
                      }}
                      onBlur={() => addTag(tagDraft)}
                      placeholder={t('items.detail.tagsPlaceholder')}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {t('items.detail.tagsInputHint')}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
                  <button type="submit" className="btn-primary" disabled={update.isPending}>{t('common.save')}</button>
                </div>
              </form>
            )
            : (
              <dl className="space-y-3 text-sm">
                {[
                  [t('items.detail.field.owner'), item.owner?.name ?? '—'],
                  [t('items.detail.field.group'), item.group?.name ?? '—'],
                  [t('items.detail.field.quantity'), item.quantity],
                  [t('items.detail.field.weight'), item.weightG != null ? `${item.weightG.toLocaleString()} g` : '—'],
                  [t('items.detail.field.shipping'), item.shippingMethod ? getLabelFromOptions(shippingOpts, item.shippingMethod) : '—'],
                  [t('items.detail.field.box'), item.box?.label ?? '—'],
                  [t('items.detail.field.useCategory'), item.useCategory ? getLabelFromOptions(categoryOpts, item.useCategory) : '—'],
                  [t('items.detail.field.notes'), item.notes ?? '—'],
                  [t('items.detail.field.specialNotes'), item.specialNotes ?? '—'],
                  [t('items.detail.field.createdAt'), formatTimestamp(item.createdAt)],
                  [t('items.detail.field.updatedAt'), formatTimestamp(item.updatedAt)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between">
                    <dt className="font-medium text-muted">{label}</dt>
                    <dd className="text-app">{value}</dd>
                  </div>
                ))}
                <button className="btn-secondary mt-4 w-full" onClick={() => setEditing(true)}>
                  {t('common.edit')}
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
