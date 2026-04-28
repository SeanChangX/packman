import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { Check, Pencil, Upload, Zap, RefreshCw, Plus, Trash2, X } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { Select } from '../lib/select'
import type { OllamaConfig } from '@packman/shared'

type Result = { ok: boolean; tags: string[]; raw: string; model: string; endpoint: string; latencyMs: number }

function formatLatency(ms?: number | null) {
  if (!ms) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function failureRate(endpoint: OllamaConfig['endpoints'][number]) {
  if (endpoint.requestCount === 0) return '—'
  return `${Math.round((endpoint.failureCount / endpoint.requestCount) * 100)}%`
}

function OllamaTest() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null)
  const [editingBaseUrl, setEditingBaseUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: config, isFetching, refetch } = useQuery({
    queryKey: ['ollama-config'],
    queryFn: adminApi.ollamaConfig,
  })

  const refreshConfig = () => qc.invalidateQueries({ queryKey: ['ollama-config'] })

  const updateModel = useMutation({
    mutationFn: (activeModel: string) => adminApi.updateOllamaConfig({ activeModel }),
    onSuccess: () => {
      refreshConfig()
      showToast('Ollama 模型已更新', 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '模型更新失敗', 'error'),
  })

  const createEndpoint = useMutation({
    mutationFn: () => adminApi.createOllamaEndpoint({ baseUrl }),
    onSuccess: () => {
      setBaseUrl('')
      refreshConfig()
      showToast('Ollama URL 已新增', 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? 'URL 新增失敗', 'error'),
  })

  const updateEndpoint = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { enabled?: boolean; baseUrl?: string } }) =>
      adminApi.updateOllamaEndpoint(id, data),
    onSuccess: () => {
      setEditingEndpointId(null)
      setEditingBaseUrl('')
      refreshConfig()
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? 'URL 更新失敗', 'error'),
  })

  const deleteEndpoint = useMutation({
    mutationFn: adminApi.deleteOllamaEndpoint,
    onSuccess: () => {
      refreshConfig()
      showToast('Ollama URL 已刪除', 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? 'URL 刪除失敗', 'error'),
  })

  const handleFile = (file: File) => {
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  const handleTest = async () => {
    if (!image) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', image)
      const res = await fetch('/api/admin/ollama-test', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) setError(json.message ?? '分析失敗')
      else {
        setResult(json)
        refreshConfig()
      }
    } catch {
      setError('請求失敗')
    } finally {
      setLoading(false)
    }
  }

  const models = config?.models ?? []
  const activeModel = config?.activeModel ?? ''
  const ok = config?.endpoints.some((endpoint) => endpoint.enabled && endpoint.ok) ?? false
  const enabledEndpointCount = config?.endpoints.filter((endpoint) => endpoint.enabled).length ?? 0
  const modelOptions = models.map((model) => {
    const availableCount = config?.endpoints.filter((endpoint) => endpoint.enabled && endpoint.models.includes(model)).length ?? 0
    return {
      value: model,
      label: `${model} (${availableCount}/${enabledEndpointCount || 0} servers)`,
    }
  })
  if (activeModel && !models.includes(activeModel)) {
    modelOptions.unshift({ value: activeModel, label: `${activeModel} (0/${enabledEndpointCount || 0} servers)` })
  }

  return (
    <div className="page space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ollama 設定與測試</h1>
          <p className="page-subtitle">設定模型與多個辨識端點，測試圖片不會寫入資料庫</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
          {isFetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          檢查狀態
        </button>
      </div>

      {config && (
        <div className={`card p-4 ${ok ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <p className="text-sm font-semibold text-app">
            {ok ? `Ollama 可用 - 目前模型：${config.activeModel}` : '沒有可用的 Ollama endpoint'}
          </p>
          <p className="mt-1 text-xs text-muted">
            已啟用 {config.endpoints.filter((endpoint) => endpoint.enabled).length} / {config.endpoints.length} 個 URL
          </p>
        </div>
      )}

      {config?.aiTagJobs && (
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            ['等待', config.aiTagJobs.queued],
            ['執行中', config.aiTagJobs.running],
            ['完成', config.aiTagJobs.done],
            ['失敗', config.aiTagJobs.failed],
            ['已取消', config.aiTagJobs.cancelled],
          ].map(([label, value]) => (
            <div key={String(label)} className="card px-4 py-3">
              <p className="text-xs font-semibold text-muted">{label}</p>
              <p className="mt-1 text-2xl font-bold text-app">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,0.9fr)]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-app">模型</h2>
                <p className="text-xs text-muted">選擇目前已下載的 vision model</p>
              </div>
              <Select
                className="w-full sm:w-72"
                value={activeModel}
                onChange={(model) => updateModel.mutate(model)}
                options={modelOptions.length > 0
                  ? modelOptions
                  : [{ value: activeModel, label: activeModel || '尚無模型' }]}
              />
            </div>
            {activeModel && enabledEndpointCount > 0 && (
              <p className="text-xs text-muted">
                建議選擇每台啟用 server 都有的模型；辨識時只會派給已下載該模型的 URL。
              </p>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-bold text-app">Ollama URLs</h2>
              <p className="text-xs text-muted">系統會優先使用平均耗時較低、失敗率較低的 URL</p>
            </div>

            <div className="divide-y divide-white/10">
              {config?.endpoints.map((endpoint) => {
                const editing = editingEndpointId === endpoint.id
                return (
                  <div key={endpoint.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${endpoint.ok ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                        {editing ? (
                          <input
                            className="input min-h-9 flex-1 py-1.5 text-sm"
                            value={editingBaseUrl}
                            onChange={(e) => setEditingBaseUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editingBaseUrl.trim()) {
                                updateEndpoint.mutate({ id: endpoint.id, data: { baseUrl: editingBaseUrl.trim() } })
                              }
                              if (e.key === 'Escape') {
                                setEditingEndpointId(null)
                                setEditingBaseUrl('')
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <p className="truncate text-sm font-semibold text-app">{endpoint.baseUrl}</p>
                        )}
                        {!endpoint.enabled && <span className="badge bg-white/10 text-muted">停用</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        辨識平均 {formatLatency(endpoint.avgLatencyMs)} · 上次 {formatLatency(endpoint.lastLatencyMs)} · 失敗率 {failureRate(endpoint)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        健康檢查 {formatLatency(endpoint.healthAvgLatencyMs)} · 上次 {formatLatency(endpoint.healthLastLatencyMs)}
                      </p>
                      {endpoint.message && <p className="mt-1 text-xs text-brand-600">{endpoint.message}</p>}
                      {endpoint.models.length > 0 && (
                        <p className="mt-1 truncate text-xs text-muted">模型：{endpoint.models.join(', ')}</p>
                      )}
                    </div>
                    {editing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-primary px-3 py-1.5 text-xs"
                          disabled={!editingBaseUrl.trim() || updateEndpoint.isPending}
                          onClick={() => updateEndpoint.mutate({ id: endpoint.id, data: { baseUrl: editingBaseUrl.trim() } })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => {
                            setEditingEndpointId(null)
                            setEditingBaseUrl('')
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => {
                            setEditingEndpointId(endpoint.id)
                            setEditingBaseUrl(endpoint.baseUrl)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => updateEndpoint.mutate({ id: endpoint.id, data: { enabled: !endpoint.enabled } })}
                        >
                          {endpoint.enabled ? '停用' : '啟用'}
                        </button>
                        <button
                          className="btn-danger px-3 py-1.5 text-xs"
                          onClick={() => { if (confirm(`刪除 ${endpoint.baseUrl}？`)) deleteEndpoint.mutate(endpoint.id) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="grid gap-2 border-t border-white/10 p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className="input"
                placeholder="http://192.168.1.10:11434"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={!baseUrl.trim() || createEndpoint.isPending}
                onClick={() => createEndpoint.mutate()}
              >
                <Plus className="h-4 w-4" />
                新增 URL
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-app">上傳圖片</h2>
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
              onDragOver={(e) => e.preventDefault()}
              className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 transition-colors hover:border-brand-500/50"
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-52 w-full rounded-lg object-contain" />
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-muted" />
                  <p className="text-sm text-muted">點擊或拖曳上傳圖片</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <button onClick={handleTest} disabled={!image || loading} className="btn-primary mt-3 w-full gap-2">
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
              {loading ? '分析中...' : '分析圖片'}
            </button>
            {error && <p className="mt-2 text-sm font-semibold text-brand-600">{error}</p>}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-app">分析結果</h2>
            {result ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted">English tags</p>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map((tag) => (
                      <span key={tag} className="badge bg-brand-500/10 text-brand-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">原始輸出</p>
                  <pre className="whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-xs text-app">{result.raw}</pre>
                </div>
                <p className="text-xs text-muted">模型：{result.model}</p>
                <p className="text-xs text-muted">URL：{result.endpoint} · {formatLatency(result.latencyMs)}</p>
              </div>
            ) : (
              <div className="flex min-h-52 items-center justify-center">
                <p className="text-sm text-muted">上傳圖片後點擊「分析圖片」</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/ollama')({ component: OllamaTest })
