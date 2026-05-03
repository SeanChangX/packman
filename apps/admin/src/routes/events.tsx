import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Calendar, Plus, Pencil, Trash2, CheckCircle, Circle, Users, X } from 'lucide-react'
import { Modal, useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Event, User } from '@packman/shared'

function MembersModal({ event, onClose }: { event: { id: string; name: string }; onClose: () => void }) {
  const t = useT()
  const { showToast } = useToast()
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([adminApi.users(), adminApi.eventMembers(event.id)])
      .then(([users, members]) => {
        setAllUsers(users)
        setSelected(new Set(members.map((m) => m.id)))
      })
      .catch((e: unknown) => showToast((e as Error)?.message ?? t('events.members.loadFailed'), 'error'))
      .finally(() => setLoading(false))
  }, [event.id])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminApi.updateEventMembers(event.id, Array.from(selected))
      showToast(t('events.members.saved'), 'success')
      onClose()
    } catch (e: unknown) {
      showToast((e as Error)?.message ?? t('events.members.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = search.trim()
    ? allUsers.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase())
        || u.email?.toLowerCase().includes(search.trim().toLowerCase()))
    : allUsers

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((u) => next.add(u.id))
      return next
    })
  }

  const clearAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((u) => next.delete(u.id))
      return next
    })
  }

  return (
    <Modal onClose={onClose}>
      <div className="card flex max-h-[80vh] w-full max-w-lg flex-col p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-bold">{t('events.members.title', { name: event.name })}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 text-xs text-muted">{t('events.members.hint')}</p>

        <input
          type="text"
          className="input mb-2"
          placeholder={t('events.members.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted">{t('events.members.matchedCount', { n: filtered.length })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-30"
              onClick={selectAllFiltered}
              disabled={loading || filtered.length === 0}
            >
              {t('events.members.selectAll')}
            </button>
            <span className="text-muted">·</span>
            <button
              type="button"
              className="font-semibold text-muted hover:text-app disabled:opacity-30"
              onClick={clearAllFiltered}
              disabled={loading || filtered.length === 0}
            >
              {t('events.members.clearAll')}
            </button>
          </div>
        </div>

        <div className="mb-4 min-h-32 flex-1 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10">
          {loading ? (
            <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t('events.members.empty')}</p>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {filtered.map((u) => (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                      className="h-4 w-4 accent-brand-500"
                    />
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
                      : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs text-white">{u.name[0]}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      {u.email && <p className="truncate text-xs text-muted">{u.email}</p>}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{t('events.members.selectedCount', { n: selected.size })}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || loading}>{t('common.save')}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function EventsPage() {
  const t = useT()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [membersFor, setMembersFor] = useState<{ id: string; name: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setEvents(await adminApi.events())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    try {
      await adminApi.createEvent({ name: newName.trim() })
      setNewName('')
      setShowCreate(false)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    setError(null)
    try {
      await adminApi.updateEvent(id, { name: editName.trim() })
      setEditingId(null)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleActivate = async (id: string) => {
    setError(null)
    try {
      await adminApi.activateEvent(id)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('events.delete.confirm', { name }))) return
    setError(null)
    try {
      await adminApi.deleteEvent(id)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('events.title')}</h1>
          <p className="page-subtitle">{t('events.subtitle')}</p>
        </div>
        <button className="btn-primary gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> {t('events.add')}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">{t('events.create.title')}</h2>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder={t('events.create.placeholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button className="btn-primary" onClick={handleCreate}>{t('events.create.submit')}</button>
            <button className="btn-secondary" onClick={() => { setShowCreate(false); setNewName('') }}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : events.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Calendar className="h-10 w-10 text-muted" />
          <p className="text-muted">{t('events.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className={`card flex items-center gap-4 p-4 ${event.isActive ? 'ring-2 ring-brand-500' : ''}`}
            >
              <button
                onClick={() => !event.isActive && handleActivate(event.id)}
                title={event.isActive ? t('events.activeTooltip') : t('events.activateTooltip')}
                className={`shrink-0 ${event.isActive ? 'text-brand-500' : 'text-muted hover:text-brand-400'}`}
              >
                {event.isActive
                  ? <CheckCircle className="h-5 w-5" />
                  : <Circle className="h-5 w-5" />
                }
              </button>

              <div className="min-w-0 flex-1">
                {editingId === event.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(event.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                    />
                    <button className="btn-primary text-sm" onClick={() => handleRename(event.id)}>{t('common.save')}</button>
                    <button className="btn-secondary text-sm" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{event.name}</span>
                      {event.isActive && (
                        <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-medium text-white">{t('events.activeBadge')}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {t('events.stats', {
                        items: event.itemCount ?? 0,
                        boxes: event.boxCount ?? 0,
                        batteries: event.batteryCount ?? 0,
                        date: new Date(event.createdAt).toLocaleDateString('zh-TW'),
                      })}
                    </p>
                  </>
                )}
              </div>

              {editingId !== event.id && (
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-xl p-2 text-muted hover:bg-white/10 hover:text-white"
                    onClick={() => setMembersFor({ id: event.id, name: event.name })}
                    title={t('events.members.action')}
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-xl p-2 text-muted hover:bg-white/10 hover:text-white"
                    onClick={() => { setEditingId(event.id); setEditName(event.name) }}
                    title={t('events.rename')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-xl p-2 text-muted hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30"
                    onClick={() => handleDelete(event.id, event.name)}
                    disabled={event.isActive}
                    title={event.isActive ? t('events.deleteDisabled') : t('events.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {membersFor && (
        <MembersModal event={membersFor} onClose={() => setMembersFor(null)} />
      )}
    </div>
  )
}

export const Route = createFileRoute('/events')({ component: EventsPage })
