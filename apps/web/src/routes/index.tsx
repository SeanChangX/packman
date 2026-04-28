import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Package, Box, Battery, CheckCircle2 } from 'lucide-react'
import { itemsApi, boxesApi, batteriesApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, cn } from '../lib/utils'
import type { PackingStatus } from '@packman/shared'

function StatCard({ icon: Icon, label, value, color, iconColor = 'text-white', to }: {
  icon: React.ElementType; label: string; value: number; color: string; iconColor?: string; to: string
}) {
  return (
    <Link to={to} className="metric-card block transition-all hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-2xl active:scale-[0.98]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">{label}</p>
          <p className="mt-1 text-3xl font-bold text-app">{value}</p>
        </div>
        <div className={cn('rounded-full p-3', color)}>
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>
      </div>
    </Link>
  )
}

const BOX_STATUS_CARD_COLORS: Record<PackingStatus, string> = {
  NOT_PACKED: 'border-red-500/25 bg-red-500/10 text-brand-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
  PACKED: 'border-black/10 bg-black/5 text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-white',
  SEALED: 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200',
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['items', 'stats'],
    queryFn: () => itemsApi.stats(),
  })
  const { data: boxes } = useQuery({
    queryKey: ['boxes'],
    queryFn: () => boxesApi.list(),
  })
  const { data: batteries } = useQuery({
    queryKey: ['batteries'],
    queryFn: () => batteriesApi.list(),
  })

  const totalItems = stats?.total ?? 0
  const packedItems = (stats?.PACKED ?? 0) + (stats?.SEALED ?? 0)
  const sealedBoxes = boxes?.filter((b) => b.status === 'SEALED').length ?? 0

  const statusGroups: Record<PackingStatus, number> = {
    NOT_PACKED: stats?.NOT_PACKED ?? 0,
    PACKED: stats?.PACKED ?? 0,
    SEALED: stats?.SEALED ?? 0,
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">總覽</h1>
          <p className="page-subtitle">打包進度與箱子狀態</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Package} label="物品總數" value={totalItems} color="bg-brand-500" to="/items" />
        <StatCard icon={CheckCircle2} label="已打包" value={packedItems} color="bg-black" to="/items" />
        <StatCard icon={Box} label="已封箱" value={sealedBoxes} color="bg-emerald-700 dark:bg-emerald-500/80" to="/boxes" />
        <StatCard
          icon={Battery}
          label="電池數"
          value={batteries?.length ?? 0}
          color="bg-white ring-1 ring-black/10 dark:ring-white/10"
          iconColor="text-black"
          to="/batteries"
        />
      </div>

      {/* Packing progress */}
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-app">打包進度</h2>
        {totalItems > 0 && (
          <div className="space-y-3">
            {(['NOT_PACKED', 'PACKED', 'SEALED'] as PackingStatus[]).map((s) => (
              <div key={s}>
                <div className="flex justify-between text-sm">
                  <span className={cn('badge', STATUS_COLORS[s])}>{STATUS_LABELS[s]}</span>
                  <span className="text-muted">{statusGroups[s]} / {totalItems}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      s === 'NOT_PACKED' ? 'bg-brand-500'
                        : s === 'PACKED' ? 'bg-zinc-900 dark:bg-white' : 'bg-emerald-600 dark:bg-emerald-400'
                    )}
                    style={{ width: `${totalItems ? (statusGroups[s] / totalItems) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Box status grid */}
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-app">箱子狀態</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {boxes?.map((box) => (
            <Link
              key={box.id}
              to="/boxes/$id"
              params={{ id: box.id }}
              className={cn(
                'flex min-h-24 flex-col items-center justify-center rounded-[22px] border p-3 text-center transition-transform hover:-translate-y-0.5',
                BOX_STATUS_CARD_COLORS[box.status]
              )}
            >
              <span className="text-lg font-bold">{box.label}</span>
              <span className="text-xs opacity-70">{STATUS_LABELS[box.status]}</span>
              {(box.totalWeightG ?? 0) > 0 && (
                <span className="mt-0.5 text-xs opacity-60">
                  {(box.totalWeightG! / 1000).toFixed(2).replace(/\.?0+$/, '')} kg
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({ component: Dashboard })
