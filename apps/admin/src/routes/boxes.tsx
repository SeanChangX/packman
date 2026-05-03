import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { Select } from '../lib/select'
import { useT } from '../lib/i18n'

function BoxesPage() {
  const t = useT()
  const SHIPPING_OPTIONS = [
    { value: 'CHECKED', label: t('boxes.shipping.checked') },
    { value: 'CARRY_ON', label: t('boxes.shipping.carryOn') },
  ] as const

  const qc = useQueryClient()
  const { showToast } = useToast()
  const [shippingMethod, setShippingMethod] = useState('CHECKED')
  const [ownerId, setOwnerId] = useState('')
  const { register, handleSubmit, reset } = useForm<{ label: string; notes?: string }>()
  const { data: boxes } = useQuery({ queryKey: ['admin-boxes'], queryFn: adminApi.boxes })
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editShipping, setEditShipping] = useState('CHECKED')
  const [editOwnerId, setEditOwnerId] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const create = useMutation({
    mutationFn: (data: { label: string; notes?: string }) =>
      adminApi.createBox({
        ...data,
        shippingMethod,
        ownerId: ownerId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-boxes'] })
      reset()
      setOwnerId('')
      showToast(t('boxes.create.saved'), 'success')
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { label: string; shippingMethod: string; ownerId: string | null; notes?: string } }) =>
      adminApi.updateBox(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-boxes'] }); setEditingId(null); showToast(t('boxes.update.saved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('boxes.update.failed'), 'error'),
  })

  const del = useMutation({
    mutationFn: adminApi.deleteBox,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-boxes'] }); showToast(t('boxes.delete.saved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('boxes.delete.failed'), 'error'),
  })

  const startEdit = (box: { id: string; label: string; shippingMethod: string; ownerId?: string | null; notes?: string | null }) => {
    setEditingId(box.id)
    setEditLabel(box.label)
    setEditShipping(box.shippingMethod)
    setEditOwnerId(box.ownerId ?? '')
    setEditNotes(box.notes ?? '')
  }

  const userOptions = [
    { value: '', label: t('boxes.owner.none') },
    ...(users?.map((u) => ({ value: u.id, label: u.name })) ?? []),
  ]

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('boxes.title')}</h1>
          <p className="page-subtitle">{t('boxes.subtitle')}</p>
        </div>
      </div>

      <form
        className="card relative z-10 grid gap-3 p-4 md:grid-cols-[1fr_10rem_12rem_1fr_auto]"
        onSubmit={handleSubmit((data) => create.mutate(data))}
      >
        <input className="input" placeholder={t('boxes.placeholder.label')} {...register('label', { required: true })} />
        <Select
          value={shippingMethod}
          onChange={setShippingMethod}
          options={SHIPPING_OPTIONS}
        />
        <Select
          value={ownerId}
          onChange={setOwnerId}
          options={userOptions}
        />
        <input className="input" placeholder={t('boxes.placeholder.notes')} {...register('notes')} />
        <button className="btn-primary" disabled={create.isPending}>
          <Plus className="h-4 w-4" /> {t('common.add')}
        </button>
        {create.isError && (
          <p className="col-span-full text-sm text-red-500">{(create.error as Error).message}</p>
        )}
      </form>

      <div className="card table-shell">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <tr>
                {[t('boxes.column.name'), t('boxes.column.shipping'), t('boxes.column.owner'), t('boxes.column.status'), t('boxes.column.notes'), t('common.actions')].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {boxes?.map((box) =>
                editingId === box.id ? (
                  <tr key={box.id} className="bg-brand-500/5">
                    <td className="px-4 py-2">
                      <input
                        className="input py-1.5 text-sm"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={editShipping}
                        onChange={setEditShipping}
                        options={SHIPPING_OPTIONS}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={editOwnerId}
                        onChange={setEditOwnerId}
                        options={userOptions}
                      />
                    </td>
                    <td className="px-4 py-2 text-muted">{box.status}</td>
                    <td className="px-4 py-2">
                      <input
                        className="input py-1.5 text-sm"
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder={t('boxes.placeholder.notes')}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          className="btn-primary px-3"
                          onClick={() => update.mutate({
                            id: box.id,
                            data: {
                              label: editLabel,
                              shippingMethod: editShipping,
                              ownerId: editOwnerId || null,
                              notes: editNotes || undefined,
                            },
                          })}
                          disabled={update.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button className="btn-secondary px-3" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={box.id}>
                    <td className="px-4 py-3 font-semibold">{box.label}</td>
                    <td className="px-4 py-3 text-muted">{box.shippingMethod === 'CHECKED' ? t('boxes.shipping.checked') : t('boxes.shipping.carryOn')}</td>
                    <td className="px-4 py-3 text-muted">{box.owner?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-muted">{box.status}</td>
                    <td className="px-4 py-3 text-muted">{box.notes ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary px-3" onClick={() => startEdit(box)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-danger px-3"
                          onClick={() => { if (confirm(t('boxes.delete.confirm', { name: box.label }))) del.mutate(box.id) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/boxes')({ component: BoxesPage })
