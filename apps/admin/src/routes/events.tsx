import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Calendar, Plus, Pencil, Trash2, CheckCircle, Circle } from 'lucide-react'
import { adminApi } from '../lib/api'
import type { Event } from '@packman/shared'

function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!confirm(`確定刪除「${name}」？此操作無法復原。`)) return
    setError(null)
    try {
      await adminApi.deleteEvent(id)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">活動管理</h1>
          <p className="page-subtitle">管理不同活動的資料（如年份活動），切換後物品、箱子、電池將顯示對應活動資料</p>
        </div>
        <button className="btn-primary gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> 新增活動
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">新增活動</h2>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="活動名稱（如：Eurobot 2026）"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button className="btn-primary" onClick={handleCreate}>建立</button>
            <button className="btn-secondary" onClick={() => { setShowCreate(false); setNewName('') }}>取消</button>
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
          <p className="text-muted">尚無活動，點擊「新增活動」開始</p>
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
                title={event.isActive ? '目前使用中' : '設為使用中'}
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
                    <button className="btn-primary text-sm" onClick={() => handleRename(event.id)}>儲存</button>
                    <button className="btn-secondary text-sm" onClick={() => setEditingId(null)}>取消</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{event.name}</span>
                      {event.isActive && (
                        <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-medium text-white">使用中</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {event.itemCount ?? 0} 項物品・{event.boxCount ?? 0} 個箱子・{event.batteryCount ?? 0} 顆電池
                      ・建立於 {new Date(event.createdAt).toLocaleDateString('zh-TW')}
                    </p>
                  </>
                )}
              </div>

              {editingId !== event.id && (
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-xl p-2 text-muted hover:bg-white/10 hover:text-white"
                    onClick={() => { setEditingId(event.id); setEditName(event.name) }}
                    title="重新命名"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-xl p-2 text-muted hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30"
                    onClick={() => handleDelete(event.id, event.name)}
                    disabled={event.isActive}
                    title={event.isActive ? '無法刪除使用中的活動' : '刪除活動'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute('/events')({ component: EventsPage })
