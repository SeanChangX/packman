import { createFileRoute } from '@tanstack/react-router'
import { Download, Package, Battery } from 'lucide-react'
import { adminApi } from '../lib/api'

function ExportPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">匯出資料</h1>
          <p className="page-subtitle">下載 CSV 供盤點與備份</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-brand-500 p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">物品清單</h2>
              <p className="text-sm text-muted">匯出所有物品資料 (CSV)</p>
            </div>
          </div>
          <p className="mb-4 text-xs text-muted">
            包含：品項名稱、負責人、組別、箱子、運送方式、數量、狀態、標籤、說明
          </p>
          <button className="btn-primary w-full gap-2" onClick={adminApi.exportItems}>
            <Download className="h-4 w-4" /> 下載 items.csv
          </button>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-black p-3 dark:bg-white">
              <Battery className="h-6 w-6 text-white dark:text-black" />
            </div>
            <div>
              <h2 className="font-semibold">電池分配名單</h2>
              <p className="text-sm text-muted">匯出電池分配資料 (CSV)</p>
            </div>
          </div>
          <p className="mb-4 text-xs text-muted">
            包含：電池編號、種類、負責人、說明
          </p>
          <button className="btn-primary w-full gap-2" onClick={adminApi.exportBatteries}>
            <Download className="h-4 w-4" /> 下載 batteries.csv
          </button>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/export')({ component: ExportPage })
