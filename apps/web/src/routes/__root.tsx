import { createRootRoute, Outlet, Link, useNavigate } from '@tanstack/react-router'
import {
  Package, Box, Battery, Printer, QrCode,
  LayoutDashboard, LogOut, Menu, X, UserCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { authApi } from '../lib/api'
import { cn } from '../lib/utils'

function NavLink({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        '[&.active]:bg-brand-50 [&.active]:text-brand-700'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

function Layout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    // Allow login error page to render without auth
    if (window.location.pathname === '/login') {
      return <Outlet />
    }
    window.location.href = '/auth/slack'
    return null
  }

  const nav = (
    <nav className="flex flex-col gap-1 px-2">
      <NavLink to="/" icon={LayoutDashboard} label="儀表板" />
      <NavLink to="/items" icon={Package} label="物品清單" />
      <NavLink to="/boxes" icon={Box} label="箱子管理" />
      <NavLink to="/batteries" icon={Battery} label="電池分配" />
      <NavLink to="/stickers" icon={Printer} label="貼紙列印" />
      <NavLink to="/scan" icon={QrCode} label="掃描 QR" />
      <NavLink to="/profile" icon={UserCircle} label="個人資料" />
    </nav>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-56 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <Package className="h-6 w-6 text-brand-500" />
          <span className="text-lg font-bold text-gray-900">Packman</span>
        </div>
        <div className="flex flex-1 flex-col gap-4 py-4">
          {nav}
        </div>
        <div className="border-t p-4">
          <div className="flex items-center gap-2">
            {user.avatarUrl
              ? <img src={user.avatarUrl} className="h-8 w-8 rounded-full" alt={user.name} />
              : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs text-white">{user.name[0]}</div>
            }
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.group?.name ?? '未分組'}</p>
            </div>
            <button
              onClick={async () => { await authApi.logout(); window.location.href = '/auth/slack' }}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-500" />
            <span className="font-bold">Packman</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded p-1">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="absolute inset-0 z-50 bg-white pt-14 md:hidden">
            <div className="p-4">{nav}</div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export const Route = createRootRoute({ component: Layout })
