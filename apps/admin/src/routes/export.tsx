import { createFileRoute } from '@tanstack/react-router'
import { Download, Package, Battery, DatabaseBackup, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function ExportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [preserveSecrets, setPreserveSecrets] = useState(true)
  const { showToast, updateToast, dismissToast } = useToast()

  const handleImport = async (file: File) => {
    const warning = preserveSecrets
      ? '還原備份會清除目前所有資料並覆蓋為備份內容（保留目前 admin 帳密與 secrets），確定繼續？'
      : '還原備份會清除目前所有資料並覆蓋為備份內容，包含 admin 帳密與 secrets，確定繼續？'
    if (!confirm(warning)) return
    setImporting(true)
    const toastId = showToast(`上傳備份中… 0%`, 'info', { sticky: true, progress: 0 })
    let serverPhase = false
    try {
      const result = await adminApi.importBackup(file, {
        preserveSecrets,
        onProgress: (loaded, total) => {
          const ratio = total ? loaded / total : 0
          if (ratio >= 1 && !serverPhase) {
            serverPhase = true
            updateToast(toastId, { message: '伺服器解壓並還原中…', progress: undefined, sticky: true })
          } else if (!serverPhase) {
            updateToast(toastId, {
              message: `上傳備份中… ${Math.floor(ratio * 100)}% (${formatBytes(loaded)} / ${formatBytes(total)})`,
              progress: ratio,
            })
          }
        },
      })
      dismissToast(toastId)
      showToast(
        `還原完成：照片 ${result.photoOk} 張成功${result.photoFail ? `、${result.photoFail} 張失敗` : ''}`,
        result.photoFail ? 'error' : 'success',
      )
    } catch (e: any) {
      dismissToast(toastId)
      showToast(e?.message ?? '備份還原失敗', 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExport = () => {
    adminApi.exportBackup()
    showToast('備份下載已開始，請在瀏覽器下載列查看進度', 'info')
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">匯出資料</h1>
          <p className="page-subtitle">下載 CSV 供盤點與備份</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card flex flex-col p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-brand-500 p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">物品清單</h2>
              <p className="text-sm text-muted">匯出所有物品資料 (CSV)</p>
            </div>
          </div>
          <div className="mb-4 flex-1 space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted">包含欄位</p>
              <div className="flex flex-wrap gap-1.5">
              {['品項名稱', '負責人', '組別', '箱子', '運送方式', '數量', '狀態', '標籤', '說明'].map((field) => (
                <span key={field} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] text-app/80 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10">
                  {field}
                </span>
              ))}
              </div>
            </div>
            <p className="text-[11px] text-muted/80">UTF-8 編碼，可直接以 Excel／Numbers 開啟</p>
          </div>
          <button className="btn-primary mt-auto w-full gap-2" onClick={adminApi.exportItems}>
            <Download className="h-4 w-4" /> 下載 items.csv
          </button>
        </div>

        <div className="card flex flex-col p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-black p-3 dark:bg-white">
              <Battery className="h-6 w-6 text-white dark:text-black" />
            </div>
            <div>
              <h2 className="font-semibold">電池分配名單</h2>
              <p className="text-sm text-muted">匯出電池分配資料 (CSV)</p>
            </div>
          </div>
          <div className="mb-4 flex-1 space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted">包含欄位</p>
              <div className="flex flex-wrap gap-1.5">
              {['電池編號', '種類', '負責人', '說明'].map((field) => (
                <span key={field} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] text-app/80 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10">
                  {field}
                </span>
              ))}
              </div>
            </div>
            <p className="text-[11px] text-muted/80">UTF-8 編碼，可直接以 Excel／Numbers 開啟</p>
          </div>
          <button className="btn-primary mt-auto w-full gap-2" onClick={adminApi.exportBatteries}>
            <Download className="h-4 w-4" /> 下載 batteries.csv
          </button>
        </div>

        <div className="card flex flex-col p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-600 p-3">
              <DatabaseBackup className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">備份與還原</h2>
              <p className="text-sm text-muted">資料庫與照片 (ZIP)</p>
            </div>
          </div>
          <p className="mb-3 flex-1 text-xs text-muted">
            包含所有活動、物品、箱子、電池、用戶、組別、選項以及 MinIO 中的所有照片。
            <span className="mt-1 block text-amber-400">⚠️ 還原會清除目前所有資料並完整覆蓋</span>
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={preserveSecrets}
            disabled={importing}
            onClick={() => setPreserveSecrets((v) => !v)}
            className={[
              'mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-left transition-colors dark:border-white/10 dark:bg-white/5',
              importing ? 'opacity-60' : 'hover:bg-black/[0.07] dark:hover:bg-white/[0.07]',
            ].join(' ')}
          >
            <span className="min-w-0 text-xs font-semibold text-app">
              還原時保留目前的 admin 帳密
            </span>
            <span
              className={[
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                preserveSecrets ? 'bg-brand-500' : 'bg-zinc-300 dark:bg-white/15',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  preserveSecrets ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
            }}
          />
          <div className="mt-auto flex gap-2">
            <button className="btn-primary flex-1 gap-2" onClick={handleExport} disabled={importing}>
              <Download className="h-4 w-4" /> 備份
            </button>
            <button
              className="btn-secondary flex-1 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4" />
              {importing ? '還原中…' : '還原'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/export')({ component: ExportPage })
