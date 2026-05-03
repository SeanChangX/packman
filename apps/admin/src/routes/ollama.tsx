import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useRef } from 'react'
import { Check, Pencil, Upload, Zap, RefreshCw, Plus, Trash2, X } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { Select } from '../lib/select'
import { useT } from '../lib/i18n'
import type { OllamaConfig } from '@packman/shared'

type Result = { ok: boolean; tags: string[]; weightG: number | null; raw: string; model: string; endpoint: string; latencyMs: number }

function formatLatency(ms?: number | null) {
  if (!ms) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function failureRate(endpoint: OllamaConfig['endpoints'][number]) {
  if (endpoint.requestCount === 0) return '—'
  return `${Math.round((endpoint.failureCount / endpoint.requestCount) * 100)}%`
}

function OllamaTest() {
  const t = useT()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [generateTimeoutSeconds, setGenerateTimeoutSeconds] = useState('60')
  const [healthTimeoutSeconds, setHealthTimeoutSeconds] = useState('5')
  const [tagPrompt, setTagPrompt] = useState('')
  const [weightPrompt, setWeightPrompt] = useState('')
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null)
  const [editingBaseUrl, setEditingBaseUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: config, isFetching, refetch } = useQuery({
    queryKey: ['ollama-config'],
    queryFn: adminApi.ollamaConfig,
  })

  useEffect(() => {
    if (!config) return
    const generateTimeoutMs = typeof config.generateTimeoutMs === 'number' ? config.generateTimeoutMs : 60_000
    const healthTimeoutMs = typeof config.healthTimeoutMs === 'number' ? config.healthTimeoutMs : 5_000
    setGenerateTimeoutSeconds(String(Math.round(generateTimeoutMs / 1000)))
    setHealthTimeoutSeconds(String(Math.round(healthTimeoutMs / 1000)))
    setTagPrompt(config.tagPrompt || config.defaultTagPrompt || '')
    setWeightPrompt(config.weightPrompt || config.defaultWeightPrompt || '')
  }, [config])

  const refreshConfig = () => qc.invalidateQueries({ queryKey: ['ollama-config'] })

  const updateEnabled = useMutation({
    mutationFn: (enabled: boolean) => adminApi.updateOllamaConfig({ enabled }),
    onSuccess: (_data, enabled) => {
      refreshConfig()
      showToast(enabled ? t('ollama.toast.aiEnabled') : t('ollama.toast.aiDisabled'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.updateFailed'), 'error'),
  })

  const updateModel = useMutation({
    mutationFn: (activeModel: string) => adminApi.updateOllamaConfig({ activeModel }),
    onSuccess: () => {
      refreshConfig()
      showToast(t('ollama.toast.modelUpdated'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.modelUpdateFailed'), 'error'),
  })

  const updateTimeouts = useMutation({
    mutationFn: () => adminApi.updateOllamaConfig({
      generateTimeoutMs: Math.round(generateTimeoutValue * 1000),
      healthTimeoutMs: Math.round(healthTimeoutValue * 1000),
    }),
    onSuccess: () => {
      refreshConfig()
      showToast(t('ollama.toast.timeoutUpdated'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.timeoutUpdateFailed'), 'error'),
  })

  const updateTagPrompt = useMutation({
    mutationFn: (prompt: string) => adminApi.updateOllamaConfig({ tagPrompt: prompt }),
    onSuccess: () => {
      refreshConfig()
      showToast(t('ollama.toast.tagPromptUpdated'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.promptUpdateFailed'), 'error'),
  })

  const updateWeightPrompt = useMutation({
    mutationFn: (prompt: string) => adminApi.updateOllamaConfig({ weightPrompt: prompt }),
    onSuccess: () => {
      refreshConfig()
      showToast(t('ollama.toast.weightPromptUpdated'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.promptUpdateFailed'), 'error'),
  })

  const createEndpoint = useMutation({
    mutationFn: () => adminApi.createOllamaEndpoint({ baseUrl }),
    onSuccess: () => {
      setBaseUrl('')
      refreshConfig()
      showToast(t('ollama.toast.urlAdded'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.urlAddFailed'), 'error'),
  })

  const updateEndpoint = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { enabled?: boolean; baseUrl?: string } }) =>
      adminApi.updateOllamaEndpoint(id, data),
    onSuccess: () => {
      setEditingEndpointId(null)
      setEditingBaseUrl('')
      refreshConfig()
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.urlUpdateFailed'), 'error'),
  })

  const deleteEndpoint = useMutation({
    mutationFn: adminApi.deleteOllamaEndpoint,
    onSuccess: () => {
      refreshConfig()
      showToast(t('ollama.toast.urlDeleted'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('ollama.toast.urlDeleteFailed'), 'error'),
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
      if (!res.ok) setError(json.message ?? t('ollama.test.parseFailed'))
      else {
        setResult(json)
        refreshConfig()
      }
    } catch {
      setError(t('ollama.test.requestFailed'))
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

  const generateTimeoutValue = Number(generateTimeoutSeconds)
  const healthTimeoutValue = Number(healthTimeoutSeconds)
  const generateTimeoutValid = Number.isFinite(generateTimeoutValue) && generateTimeoutValue >= 5 && generateTimeoutValue <= 600
  const healthTimeoutValid = Number.isFinite(healthTimeoutValue) && healthTimeoutValue >= 1 && healthTimeoutValue <= 60
  const promptValid = tagPrompt.trim().length > 0 && tagPrompt.trim().length <= 2000
  const weightPromptValid = weightPrompt.trim().length > 0 && weightPrompt.trim().length <= 2000

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('ollama.title')}</h1>
          <p className="page-subtitle">{t('ollama.subtitle')}</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
          {isFetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t('ollama.checkStatus')}
        </button>
      </div>

      {config && (
        <div className={`card p-4 ${
          !config.enabled
            ? 'border-amber-500/30 bg-amber-500/5'
            : ok
              ? 'border-green-500/20 bg-green-500/5'
              : 'border-red-500/20 bg-red-500/5'
        }`}>
          <p className="text-sm font-semibold text-app">
            {!config.enabled
              ? t('ollama.status.disabled')
              : ok
                ? t('ollama.status.ok', { model: config.activeModel })
                : t('ollama.status.noEndpoint')}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t('ollama.status.endpointCount', {
              enabled: config.endpoints.filter((endpoint) => endpoint.enabled).length,
              total: config.endpoints.length,
            })}
          </p>
        </div>
      )}

      {config?.aiTagJobs && (
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            [t('ollama.jobs.queued'), config.aiTagJobs.queued],
            [t('ollama.jobs.running'), config.aiTagJobs.running],
            [t('ollama.jobs.done'), config.aiTagJobs.done],
            [t('ollama.jobs.failed'), config.aiTagJobs.failed],
            [t('ollama.jobs.cancelled'), config.aiTagJobs.cancelled],
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-app">{t('ollama.section.ai')}</h2>
                <p className="text-xs text-muted">
                  {t('ollama.section.ai.subtitle')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config?.enabled ?? false}
                disabled={updateEnabled.isPending || !config}
                onClick={() => config && updateEnabled.mutate(!config.enabled)}
                className={[
                  'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
                  config?.enabled ? 'bg-brand-500' : 'bg-white/15',
                  updateEnabled.isPending ? 'opacity-60' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                    config?.enabled ? 'translate-x-6' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>

          <div className={`card p-5 ${config && !config.enabled ? 'opacity-60' : ''}`}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-app">{t('ollama.section.model')}</h2>
                <p className="text-xs text-muted">{t('ollama.section.model.subtitle')}</p>
              </div>
              <Select
                className="w-full sm:w-72"
                value={activeModel}
                onChange={(model) => updateModel.mutate(model)}
                options={modelOptions.length > 0
                  ? modelOptions
                  : [{ value: activeModel, label: activeModel || t('ollama.section.model.empty') }]}
              />
            </div>
            {activeModel && enabledEndpointCount > 0 && (
              <p className="text-xs text-muted">
                {t('ollama.section.model.hint')}
              </p>
            )}
          </div>

          <div className="card p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-app">{t('ollama.section.timeout')}</h2>
              <p className="text-xs text-muted">{t('ollama.section.timeout.subtitle')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <label className="block">
                <span className="label">{t('ollama.timeout.generate')}</span>
                <input
                  className="input mt-1"
                  type="number"
                  min={5}
                  max={600}
                  value={generateTimeoutSeconds}
                  onChange={(e) => setGenerateTimeoutSeconds(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="label">{t('ollama.timeout.health')}</span>
                <input
                  className="input mt-1"
                  type="number"
                  min={1}
                  max={60}
                  value={healthTimeoutSeconds}
                  onChange={(e) => setHealthTimeoutSeconds(e.target.value)}
                />
              </label>
              <button
                className="btn-primary"
                disabled={!generateTimeoutValid || !healthTimeoutValid || updateTimeouts.isPending}
                onClick={() => updateTimeouts.mutate()}
              >
                {t('common.save')}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              {t('ollama.timeout.current', {
                generate: Math.round((config?.generateTimeoutMs ?? 60_000) / 1000),
                health: Math.round((config?.healthTimeoutMs ?? 5_000) / 1000),
              })}
            </p>
          </div>

          <div className="card p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-app">{t('ollama.section.tagPrompt')}</h2>
              <p className="text-xs text-muted">{t('ollama.section.tagPrompt.subtitle')}</p>
            </div>
            <textarea
              className="input min-h-40 font-mono text-xs"
              value={tagPrompt}
              onChange={(e) => setTagPrompt(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setTagPrompt(config?.defaultTagPrompt ?? '')}
              >
                {t('ollama.prompt.restoreDefault')}
              </button>
              <button
                className="btn-primary"
                disabled={!promptValid || updateTagPrompt.isPending}
                onClick={() => updateTagPrompt.mutate(tagPrompt.trim())}
              >
                {t('common.save')}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">{tagPrompt.length} / 2000</p>
          </div>

          <div className="card p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-app">{t('ollama.section.weightPrompt')}</h2>
              <p className="text-xs text-muted">{t('ollama.section.weightPrompt.subtitle')}</p>
            </div>
            <textarea
              className="input min-h-28 font-mono text-xs"
              value={weightPrompt}
              onChange={(e) => setWeightPrompt(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setWeightPrompt(config?.defaultWeightPrompt ?? '')}
              >
                {t('ollama.prompt.restoreDefault')}
              </button>
              <button
                className="btn-primary"
                disabled={!weightPromptValid || updateWeightPrompt.isPending}
                onClick={() => updateWeightPrompt.mutate(weightPrompt.trim())}
              >
                {t('common.save')}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">{weightPrompt.length} / 2000</p>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-bold text-app">{t('ollama.section.urls')}</h2>
              <p className="text-xs text-muted">{t('ollama.section.urls.subtitle')}</p>
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
                        {!endpoint.enabled && <span className="badge bg-white/10 text-muted">{t('ollama.endpoint.disabled')}</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {t('ollama.endpoint.stats', {
                          avg: formatLatency(endpoint.avgLatencyMs),
                          last: formatLatency(endpoint.lastLatencyMs),
                          rate: failureRate(endpoint),
                        })}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t('ollama.endpoint.health', {
                          avg: formatLatency(endpoint.healthAvgLatencyMs),
                          last: formatLatency(endpoint.healthLastLatencyMs),
                        })}
                      </p>
                      {endpoint.message && <p className="mt-1 text-xs text-brand-600">{endpoint.message}</p>}
                      {endpoint.models.length > 0 && (
                        <p className="mt-1 truncate text-xs text-muted">{t('ollama.endpoint.models', { models: endpoint.models.join(', ') })}</p>
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
                          {endpoint.enabled ? t('ollama.endpoint.disable') : t('ollama.endpoint.enable')}
                        </button>
                        <button
                          className="btn-danger px-3 py-1.5 text-xs"
                          onClick={() => { if (confirm(t('ollama.endpoint.deleteConfirm', { url: endpoint.baseUrl }))) deleteEndpoint.mutate(endpoint.id) }}
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
                {t('ollama.endpoint.addUrl')}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-app">{t('ollama.upload.title')}</h2>
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
                  <p className="text-sm text-muted">{t('ollama.upload.dropHint')}</p>
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
              {loading ? t('ollama.test.analyzing') : t('ollama.test.analyze')}
            </button>
            {error && <p className="mt-2 text-sm font-semibold text-brand-600">{error}</p>}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-app">{t('ollama.result.title')}</h2>
            {result ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted">{t('ollama.result.tags')}</p>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map((tag) => (
                      <span key={tag} className="badge bg-brand-500/10 text-brand-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">{t('ollama.result.weight')}</p>
                  <p className="text-sm font-semibold text-app">
                    {result.weightG != null ? `${result.weightG.toLocaleString()} g` : t('ollama.result.weight.none')}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">{t('ollama.result.raw')}</p>
                  <pre className="whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-xs text-app">{result.raw}</pre>
                </div>
                <p className="text-xs text-muted">{t('ollama.result.model', { model: result.model })}</p>
                <p className="text-xs text-muted">{t('ollama.result.endpoint', { endpoint: result.endpoint, latency: formatLatency(result.latencyMs) })}</p>
              </div>
            ) : (
              <div className="flex min-h-52 items-center justify-center">
                <p className="text-sm text-muted">{t('ollama.result.empty')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/ollama')({ component: OllamaTest })
