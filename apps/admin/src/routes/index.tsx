import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../lib/api'
import { useT } from '../lib/i18n'

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
  const t = useT()

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t('dashboard.users')} value={stats?.users ?? 0} color="text-brand-600" />
        <StatCard label={t('dashboard.items')} value={stats?.items ?? 0} color="text-app" />
        <StatCard label={t('dashboard.boxes')} value={stats?.boxes ?? 0} color="text-app" />
        <StatCard label={t('dashboard.batteries')} value={stats?.batteries ?? 0} color="text-brand-600" />
        <StatCard label={t('dashboard.packedItems')} value={stats?.packedItems ?? 0} color="text-app" />
        <StatCard label={t('dashboard.sealedBoxes')} value={stats?.sealedBoxes ?? 0} color="text-app" />
        <StatCard label={t('dashboard.groups')} value={stats?.groups ?? 0} color="text-app" />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({ component: AdminDashboard })
