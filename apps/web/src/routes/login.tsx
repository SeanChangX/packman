import { createFileRoute } from '@tanstack/react-router'
import { Package } from 'lucide-react'

function Login() {
  const search = new URLSearchParams(window.location.search)
  const error = search.get('error')

  const errorMessages: Record<string, string> = {
    slack_denied: 'Slack 登入被拒絕，請重試。',
    wrong_workspace: '請使用指定的 Slack Workspace 登入。',
    auth_failed: '登入失敗，請重試。',
  }

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-7 text-center sm:p-9">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-brand-500 shadow-2xl shadow-red-500/30">
            <Package className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-app">Packman</h1>
        <p className="mb-6 text-sm font-medium text-muted">行李管理系統 - 請使用 Slack 帳號登入</p>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/15 bg-red-500/10 p-3 text-sm font-semibold text-brand-600">
            {errorMessages[error] ?? '發生錯誤，請重試。'}
          </div>
        )}

        <a
          href="/auth/slack"
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          使用 Slack 登入
        </a>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/login')({ component: Login })
