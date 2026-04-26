import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../lib/api'

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function AdminDashboard() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin 儀表板</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="用戶數" value={stats?.users ?? 0} color="text-indigo-600" />
        <StatCard label="物品數" value={stats?.items ?? 0} color="text-blue-600" />
        <StatCard label="箱子數" value={stats?.boxes ?? 0} color="text-amber-600" />
        <StatCard label="電池數" value={stats?.batteries ?? 0} color="text-purple-600" />
        <StatCard label="已打包物品" value={stats?.packedItems ?? 0} color="text-green-600" />
        <StatCard label="已封箱" value={stats?.sealedBoxes ?? 0} color="text-green-700" />
        <StatCard label="組別數" value={stats?.groups ?? 0} color="text-gray-600" />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({ component: AdminDashboard })
