import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Package, Box, Battery, CheckCircle2 } from 'lucide-react'
import { itemsApi, boxesApi, batteriesApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, cn } from '../lib/utils'
import type { PackingStatus } from '@packman/shared'

function StatCard({ icon: Icon, label, value, color, to }: {
  icon: React.ElementType; label: string; value: number; color: string; to: string
}) {
  return (
    <Link to={to} className="metric-card block transition-all hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-2xl active:scale-[0.98]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">{label}</p>
          <p className="mt-1 text-3xl font-bold text-app">{value}</p>
        </div>
        <div className={cn('rounded-full p-3', color)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Link>
  )
}

function Dashboard() {
  const { data: items } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => itemsApi.list({ pageSize: 200 }),
  })
  const { data: boxes } = useQuery({
    queryKey: ['boxes'],
    queryFn: () => boxesApi.list(),
  })
  const { data: batteries } = useQuery({
    queryKey: ['batteries'],
    queryFn: () => batteriesApi.list(),
  })

  const totalItems = items?.total ?? 0
  const packedItems = items?.data.filter(
    (i) => i.status === 'PACKED' || i.status === 'SEALED'
  ).length ?? 0
  const sealedBoxes = boxes?.filter((b) => b.status === 'SEALED').length ?? 0

  const statusGroups: Record<PackingStatus, number> = {
    NOT_PACKED: 0, PACKED: 0, SEALED: 0,
  }
  items?.data.forEach((i) => statusGroups[i.status]++)

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
        <StatCard icon={Box} label="已封箱" value={sealedBoxes} color="bg-zinc-700" to="/boxes" />
        <StatCard icon={Battery} label="電池數" value={batteries?.length ?? 0} color="bg-red-950" to="/batteries" />
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
                        : s === 'PACKED' ? 'bg-zinc-900 dark:bg-white' : 'bg-black dark:bg-zinc-300'
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
                box.status === 'SEALED' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                  : box.status === 'PACKED' ? 'border-brand-500 bg-brand-500/10' : 'border-black/10 bg-white/45 dark:border-white/10 dark:bg-white/5'
              )}
            >
              <span className="text-lg font-bold">{box.label}</span>
              <span className="text-xs opacity-70">{STATUS_LABELS[box.status]}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({ component: Dashboard })
