import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { useState } from 'react'
import { adminApi } from '../lib/api'

function AdminLogin() {
  const navigate = useNavigate()
  const { data: status, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ['admin-auth-status'],
    queryFn: adminApi.adminStatus,
    retry: false,
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setupRequired = status?.setupRequired ?? false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (setupRequired) {
        if (password !== confirmPassword) {
          setError('兩次密碼不一致')
          return
        }
        await adminApi.setupAdmin(username, password)
        await refetch()
      }
      await adminApi.login(username, password)
      navigate({ to: '/' })
    } catch (e: unknown) {
      setError((e as Error)?.message ?? '帳號或密碼錯誤')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-7 sm:p-9">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-brand-500 shadow-2xl shadow-red-500/30">
            <Package className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="mb-1 text-center text-3xl font-bold text-app">Packman Admin</h1>
        <p className="mb-6 text-center text-sm font-medium text-muted">
          {setupRequired ? '請建立管理員帳號' : '管理控制台'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-2xl border border-red-500/15 bg-red-500/10 p-3 text-sm font-semibold text-brand-600">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="label">帳號</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input"
              autoComplete="username"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              autoComplete="current-password"
              required
            />
          </div>
          {setupRequired && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="label">確認密碼</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs font-medium leading-relaxed text-muted">
                密碼至少 12 字元，需包含大小寫字母、數字、符號其中至少 3 類，且不可包含帳號或常見弱密碼字詞。
              </div>
            </>
          )}
          <button type="submit" className="btn-primary mt-1" disabled={loading || statusLoading}>
            {statusLoading ? '載入中…' : loading ? (setupRequired ? '建立中…' : '登入中…') : (setupRequired ? '建立並登入' : '登入')}
          </button>
        </form>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/login')({ component: AdminLogin })
