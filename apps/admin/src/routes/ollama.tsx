import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { Upload, Zap, RefreshCw } from 'lucide-react'

type Status = { ok: boolean; models: string[]; activeModel: string; message?: string }
type Result = { ok: boolean; tags: string[]; raw: string; model: string }

function OllamaTest() {
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  const checkStatus = async () => {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/admin/ollama-status', { credentials: 'include' })
      setStatus(await res.json())
    } finally {
      setStatusLoading(false)
    }
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
      else setResult(json)
    } catch {
      setError('請求失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ollama 測試</h1>
          <p className="page-subtitle">上傳圖片測試 AI 標籤辨識，不會寫入資料庫</p>
        </div>
        <button onClick={checkStatus} disabled={statusLoading} className="btn-secondary">
          {statusLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          檢查狀態
        </button>
      </div>

      {status && (
        <div
          className={`card p-4 ${status.ok ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}
        >
          <p className="text-sm font-semibold text-app">
            {status.ok ? `✓ Ollama 正常 — 使用模型: ${status.activeModel}` : `✗ ${status.message ?? 'Ollama 無法連線'}`}
          </p>
          {status.ok && status.models.length > 0 && (
            <p className="mt-1 text-xs text-muted">可用模型: {status.models.join(', ')}</p>
          )}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
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
            {loading ? '分析中…' : '分析圖片'}
          </button>
          {error && <p className="mt-2 text-sm font-semibold text-brand-600">{error}</p>}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-app">分析結果</h2>
          {result ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">標籤</p>
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
              <p className="text-xs text-muted">模型: {result.model}</p>
            </div>
          ) : (
            <div className="flex min-h-52 items-center justify-center">
              <p className="text-sm text-muted">上傳圖片後點擊「分析圖片」</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/ollama')({ component: OllamaTest })
