import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../lib/api'

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="metric-card">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function AdminDashboard() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">儀表板</h1>
          <p className="page-subtitle">系統資料與打包狀態</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="用戶數" value={stats?.users ?? 0} color="text-brand-600" />
        <StatCard label="物品數" value={stats?.items ?? 0} color="text-app" />
        <StatCard label="箱子數" value={stats?.boxes ?? 0} color="text-app" />
        <StatCard label="電池數" value={stats?.batteries ?? 0} color="text-brand-600" />
        <StatCard label="已打包物品" value={stats?.packedItems ?? 0} color="text-app" />
        <StatCard label="已封箱" value={stats?.sealedBoxes ?? 0} color="text-app" />
        <StatCard label="組別數" value={stats?.groups ?? 0} color="text-app" />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({ component: AdminDashboard })
