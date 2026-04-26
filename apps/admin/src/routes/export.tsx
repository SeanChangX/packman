import { createFileRoute } from '@tanstack/react-router'
import { Download, Package, Battery } from 'lucide-react'
import { adminApi } from '../lib/api'

function ExportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">匯出資料</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-3">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold">物品清單</h2>
              <p className="text-sm text-gray-500">匯出所有物品資料 (CSV)</p>
            </div>
          </div>
          <p className="mb-4 text-xs text-gray-400">
            包含：品項名稱、負責人、組別、箱子、運送方式、數量、狀態、標籤、說明
          </p>
          <button className="btn-primary w-full gap-2" onClick={adminApi.exportItems}>
            <Download className="h-4 w-4" /> 下載 items.csv
          </button>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-3">
              <Battery className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold">電池分配名單</h2>
              <p className="text-sm text-gray-500">匯出電池分配資料 (CSV)</p>
            </div>
          </div>
          <p className="mb-4 text-xs text-gray-400">
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
