import { createFileRoute } from '@tanstack/react-router'
import { Download, Package, Battery, DatabaseBackup, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { adminApi } from '../lib/api'

function ExportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const handleImport = async (file: File) => {
    if (!confirm('還原備份會清除目前所有資料並覆蓋為備份內容，確定繼續？')) return
    setImporting(true)
    setImportMsg(null)
    try {
      const result = await adminApi.importBackup(file)
      setImportMsg({
        type: 'ok',
        text: `還原完成：照片 ${result.photoOk} 張成功${result.photoFail ? `、${result.photoFail} 張失敗` : ''}`,
      })
    } catch (e: any) {
      setImportMsg({ type: 'err', text: e.message })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">匯出資料</h1>
          <p className="page-subtitle">下載 CSV 供盤點與備份</p>
        </div>
      </div>

      {importMsg && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          importMsg.type === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          {importMsg.text}
        </div>
      )}

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
          <p className="mb-4 flex-1 text-xs text-muted">
            包含：品項名稱、負責人、組別、箱子、運送方式、數量、狀態、標籤、說明
          </p>
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
          <p className="mb-4 flex-1 text-xs text-muted">
            包含：電池編號、種類、負責人、說明
          </p>
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
          <p className="mb-4 flex-1 text-xs text-muted">
            包含所有活動、物品、箱子、電池、用戶、組別、選項以及 MinIO 中的所有照片。
            <span className="mt-1 block text-amber-400">⚠️ 還原會清除目前所有資料並完整覆蓋</span>
          </p>
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
            <button className="btn-primary flex-1 gap-2" onClick={adminApi.exportBackup} disabled={importing}>
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
