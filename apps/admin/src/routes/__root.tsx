import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { Users, Layers, Download, LayoutDashboard } from 'lucide-react'

const navItems = [
  { to: '/' as const, icon: LayoutDashboard, label: '儀表板' },
  { to: '/users' as const, icon: Users, label: '用戶管理' },
  { to: '/groups' as const, icon: Layers, label: '組別管理' },
  { to: '/export' as const, icon: Download, label: '匯出資料' },
]

function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-52 flex-col border-r bg-gray-900 text-white">
        <div className="flex items-center gap-2 border-b border-gray-700 px-4 py-4">
          <span className="text-sm font-bold text-indigo-400">⚙ Packman Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white [&.active]:bg-indigo-600 [&.active]:text-white"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}

export const Route = createRootRoute({ component: AdminLayout })
