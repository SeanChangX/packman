import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import {
  Package, ClipboardList, Battery, Printer, QrCode,
  LayoutDashboard, LogOut, Menu, X, UserCircle, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { authApi } from '../lib/api'
import { cn } from '../lib/utils'

function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
        <AlertTriangle className="h-8 w-8 text-brand-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-app">發生了一些問題</h1>
        <p className="max-w-sm text-sm text-muted">{error.message}</p>
      </div>
      <button onClick={reset} className="btn-secondary gap-2">
        <RotateCcw className="h-4 w-4" />
        重試
      </button>
    </div>
  )
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '總覽' },
  { to: '/items', icon: ClipboardList, label: '物品清單' },
  { to: '/boxes', icon: Package, label: '箱子清單' },
  { to: '/batteries', icon: Battery, label: '電池分配' },
  { to: '/stickers', icon: Printer, label: '貼紙列印', adminOnly: true },
  { to: '/profile', icon: UserCircle, label: '我的' },
]

function NavLink({ to, icon: Icon, label, compact = false }: {
  to: string; icon: React.ElementType; label: string; compact?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        compact
          ? 'flex min-w-[4.4rem] flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-white/60 transition-colors'
          : 'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-white/70 transition-colors',
        compact
          ? '[&.active]:bg-white/12 [&.active]:text-white'
          : 'hover:bg-white/10 hover:text-white [&.active]:bg-brand-500 [&.active]:text-white'
      )}
    >
      <Icon className={compact ? 'h-5 w-5' : 'h-4 w-4'} />
      {label}
    </Link>
  )
}

function Layout() {
  const { user, loading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      window.location.href = '/login'
    }
  }

  if (window.location.pathname === '/login') {
    return <Outlet />
  }

  if (!loading && !user) {
    window.location.href = '/login'
    return null
  }

  const visibleNavItems = loading
    ? []
    : navItems.filter((item) => !item.adminOnly || user!.role === 'ADMIN')

  const nav = (
    <nav className="flex flex-col gap-1 px-2">
      {visibleNavItems.map((item) => <NavLink key={item.to} {...item} />)}
    </nav>
  )

  return (
    <div className="app-shell flex overflow-hidden">
      <aside className="glass-nav hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-red-500/30">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="block text-base font-bold text-white">Packman</span>
            <span className="text-xs font-medium text-white/50">行李管理系統</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 py-4">
          {nav}
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} className="h-8 w-8 rounded-full" alt={user.name} />
                  : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs text-white">{user.name[0]}</div>
                }
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                  <p className="truncate text-xs text-white/50">{user.group?.name ?? '未分組'}</p>
                </div>
              </>
            ) : (
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
            )}
            <button
              onClick={logout}
              className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
              title="登出"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass-nav sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-500">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white">Packman</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-2xl p-2 text-white/80">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {mobileOpen && (
          <div className="glass-nav absolute inset-x-3 top-16 z-50 rounded-[28px] border p-3 md:hidden">
            <div className="p-4">{nav}</div>
            <button
              onClick={logout}
              className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </div>
        )}

        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="page">
            {loading
              ? <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
              : <Outlet />
            }
          </div>
        </main>
      </div>
      <Link
        to="/scan"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-2xl shadow-red-500/30 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        title="掃描 QR Code"
      >
        <QrCode className="h-6 w-6" />
      </Link>
    </div>
  )
}

export const Route = createRootRoute({
  component: Layout,
  errorComponent: ({ error, reset }) => <ErrorPage error={error as Error} reset={reset} />,
})
