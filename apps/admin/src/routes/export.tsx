import { createFileRoute } from '@tanstack/react-router'
import { Download, Package, Battery, DatabaseBackup, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { useT } from '../lib/i18n'

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
  const t = useT()

  const handleImport = async (file: File) => {
    const warning = preserveSecrets
      ? t('export.backup.confirmPreserve')
      : t('export.backup.confirmFull')
    if (!confirm(warning)) return
    setImporting(true)
    const toastId = showToast(t('export.backup.uploadProgress', { percent: 0, loaded: '0 B', total: '?' }), 'info', { sticky: true, progress: 0 })
    let serverPhase = false
    try {
      const result = await adminApi.importBackup(file, {
        preserveSecrets,
        onProgress: (loaded, total) => {
          const ratio = total ? loaded / total : 0
          if (ratio >= 1 && !serverPhase) {
            serverPhase = true
            updateToast(toastId, { message: t('export.backup.serverPhase'), progress: undefined, sticky: true })
          } else if (!serverPhase) {
            updateToast(toastId, {
              message: t('export.backup.uploadProgress', {
                percent: Math.floor(ratio * 100),
                loaded: formatBytes(loaded),
                total: formatBytes(total),
              }),
              progress: ratio,
            })
          }
        },
      })
      dismissToast(toastId)
      showToast(
        result.photoFail
          ? t('export.backup.completedWithFail', { ok: result.photoOk, fail: result.photoFail })
          : t('export.backup.completed', { ok: result.photoOk }),
        result.photoFail ? 'error' : 'success',
      )
    } catch (e: any) {
      dismissToast(toastId)
      showToast(e?.message ?? t('export.backup.failed'), 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExport = () => {
    adminApi.exportBackup()
    showToast(t('export.backup.startedDownload'), 'info')
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('export.title')}</h1>
          <p className="page-subtitle">{t('export.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card flex flex-col p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-brand-500 p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">{t('export.items.title')}</h2>
              <p className="text-sm text-muted">{t('export.items.subtitle')}</p>
            </div>
          </div>
          <div className="mb-4 flex-1 space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted">{t('export.fields')}</p>
              <div className="flex flex-wrap gap-1.5">
              {['export.field.itemName', 'export.field.owner', 'export.field.group', 'export.field.box', 'export.field.shipping', 'export.field.quantity', 'export.field.status', 'export.field.tags', 'export.field.notes'].map((key) => (
                <span key={key} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] text-app/80 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10">
                  {t(key)}
                </span>
              ))}
              </div>
            </div>
            <p className="text-[11px] text-muted/80">{t('export.utf8Hint')}</p>
          </div>
          <button className="btn-primary mt-auto w-full gap-2" onClick={adminApi.exportItems}>
            <Download className="h-4 w-4" /> {t('export.download.items')}
          </button>
        </div>

        <div className="card flex flex-col p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-black p-3 dark:bg-white">
              <Battery className="h-6 w-6 text-white dark:text-black" />
            </div>
            <div>
              <h2 className="font-semibold">{t('export.batteries.title')}</h2>
              <p className="text-sm text-muted">{t('export.batteries.subtitle')}</p>
            </div>
          </div>
          <div className="mb-4 flex-1 space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted">{t('export.fields')}</p>
              <div className="flex flex-wrap gap-1.5">
              {['export.field.batteryNo', 'export.field.batteryType', 'export.field.owner', 'export.field.description'].map((key) => (
                <span key={key} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] text-app/80 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10">
                  {t(key)}
                </span>
              ))}
              </div>
            </div>
            <p className="text-[11px] text-muted/80">{t('export.utf8Hint')}</p>
          </div>
          <button className="btn-primary mt-auto w-full gap-2" onClick={adminApi.exportBatteries}>
            <Download className="h-4 w-4" /> {t('export.download.batteries')}
          </button>
        </div>

        <div className="card flex flex-col p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-600 p-3">
              <DatabaseBackup className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">{t('export.backup.title')}</h2>
              <p className="text-sm text-muted">{t('export.backup.subtitle')}</p>
            </div>
          </div>
          <p className="mb-3 flex-1 text-xs text-muted">
            {t('export.backup.description')}
            <span className="mt-1 block text-amber-400">{t('export.backup.warning')}</span>
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
              {t('export.backup.preserveSecrets')}
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
              <Download className="h-4 w-4" /> {t('export.backup.button')}
            </button>
            <button
              className="btn-secondary flex-1 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4" />
              {importing ? t('export.backup.restoring') : t('export.backup.restoreButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/export')({ component: ExportPage })
