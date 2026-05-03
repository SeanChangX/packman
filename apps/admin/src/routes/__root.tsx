import { createRootRoute, Outlet, Link, redirect, useLocation } from '@tanstack/react-router'
import { Users, Tag, Download, LayoutDashboard, Package, Battery, LogOut, Cpu, List, Settings, CalendarDays, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { adminApi } from '../lib/api'

const navItems = [
  { to: '/' as const, icon: LayoutDashboard, label: '儀表板' },
  { to: '/events' as const, icon: CalendarDays, label: '活動管理' },
  { to: '/users' as const, icon: Users, label: '用戶管理' },
  { to: '/boxes' as const, icon: Package, label: '箱子管理' },
  { to: '/groups' as const, icon: Tag, label: '組別管理' },
  { to: '/battery-regulations' as const, icon: Battery, label: '電池規定' },
  { to: '/select-options' as const, icon: List, label: '選項管理' },
  { to: '/export' as const, icon: Download, label: '匯出資料' },
  { to: '/ollama' as const, icon: Cpu, label: 'AI 辨識' },
  { to: '/settings' as const, icon: Settings, label: '系統設定' },
]

function AdminLayout() {
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (pathname === '/login') return <Outlet />

  const handleLogout = async () => {
    try { await adminApi.logout() } catch {}
    window.location.href = '/login'
  }

  return (
    <div className="app-shell flex overflow-hidden">
      <aside className="glass-nav hidden h-[100dvh] w-64 shrink-0 flex-col overflow-hidden border-r md:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="block text-base font-bold text-white">Packman Admin</span>
            <span className="text-xs font-medium text-white/50">管理控制台</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white [&.active]:bg-brand-500 [&.active]:text-white"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <div className="mt-auto pt-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </div>
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass-nav fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-500">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white">Packman Admin</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-2xl p-2 text-white/80">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        <div className="h-[61px] shrink-0 md:hidden" aria-hidden="true" />

        {mobileOpen && (
          <div className="glass-nav fixed inset-x-3 top-[69px] z-50 rounded-[28px] border p-3 md:hidden">
            <nav className="flex flex-col gap-1 p-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white [&.active]:bg-brand-500 [&.active]:text-white"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className="mx-1 mb-1 mt-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-2xl border border-white/10 px-3 py-3 text-sm font-semibold text-white/50 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </div>
        )}

        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') return
    const res = await fetch('/auth/admin-me', { credentials: 'include' })
    if (!res.ok) throw redirect({ to: '/login' })
  },
  component: AdminLayout,
})
