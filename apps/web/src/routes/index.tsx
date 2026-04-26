import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Package, Box, Battery, CheckCircle2, Clock } from 'lucide-react'
import { itemsApi, boxesApi, batteriesApi } from '../lib/api'
import { STATUS_LABELS, STATUS_COLORS, cn } from '../lib/utils'
import type { PackingStatus } from '@packman/shared'

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={cn('rounded-full p-3', color)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">儀表板</h1>
        <p className="text-sm text-gray-500">打包進度總覽</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Package} label="物品總數" value={totalItems} color="bg-indigo-500" />
        <StatCard icon={CheckCircle2} label="已打包" value={packedItems} color="bg-green-500" />
        <StatCard icon={Box} label="已封箱" value={sealedBoxes} color="bg-amber-500" />
        <StatCard icon={Battery} label="電池數" value={batteries?.length ?? 0} color="bg-purple-500" />
      </div>

      {/* Packing progress */}
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-900">打包進度</h2>
        {totalItems > 0 && (
          <div className="space-y-3">
            {(['NOT_PACKED', 'PACKED', 'SEALED'] as PackingStatus[]).map((s) => (
              <div key={s}>
                <div className="flex justify-between text-sm">
                  <span className={cn('badge', STATUS_COLORS[s])}>{STATUS_LABELS[s]}</span>
                  <span className="text-gray-600">{statusGroups[s]} / {totalItems}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      s === 'NOT_PACKED' ? 'bg-red-400'
                        : s === 'PACKED' ? 'bg-yellow-400' : 'bg-green-400'
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
        <h2 className="mb-4 font-semibold text-gray-900">箱子狀態</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {boxes?.map((box) => (
            <a
              key={box.id}
              href={`/boxes/${box.id}`}
              className={cn(
                'flex flex-col items-center rounded-lg border-2 p-3 text-center transition-colors hover:bg-gray-50',
                box.status === 'SEALED' ? 'border-green-400'
                  : box.status === 'PACKED' ? 'border-yellow-400' : 'border-gray-200'
              )}
            >
              <span className="text-lg font-bold">{box.label}</span>
              <span className="text-xs text-gray-500">{STATUS_LABELS[box.status]}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({ component: Dashboard })
