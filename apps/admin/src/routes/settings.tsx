import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Save, ShieldCheck, Slack, Globe2 } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'

const MASKED_SECRET = '••••••••••••'

function SettingsPage() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.settings,
  })

  const [appUrl, setAppUrl] = useState('')
  const [adminUrl, setAdminUrl] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [slackClientId, setSlackClientId] = useState('')
  const [slackClientSecret, setSlackClientSecret] = useState('')
  const [slackWorkspaceId, setSlackWorkspaceId] = useState('')
  const [slackRedirectUri, setSlackRedirectUri] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('')

  useEffect(() => {
    if (!settings) return
    setAppUrl(settings.app.appUrl)
    setAdminUrl(settings.app.adminUrl)
    setApiUrl(settings.app.apiUrl)
    setSlackClientId(settings.slack.clientId)
    setSlackWorkspaceId(settings.slack.workspaceId)
    setSlackRedirectUri(settings.slack.redirectUri)
    setSlackClientSecret(settings.slack.clientSecretSet ? MASKED_SECRET : '')
    setAdminUsername(settings.admin.username)
  }, [settings])

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-settings'] })

  const updateApp = useMutation({
    mutationFn: () => adminApi.updateAppSettings({
      appUrl: appUrl.trim(),
      adminUrl: adminUrl.trim(),
      apiUrl: apiUrl.trim(),
    }),
    onSuccess: () => { refresh(); showToast('App URLs 已更新', 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? 'App URLs 更新失敗', 'error'),
  })

  const updateSlack = useMutation({
    mutationFn: () => adminApi.updateSlackSettings({
      clientId: slackClientId.trim(),
      clientSecret: slackClientSecret === MASKED_SECRET ? undefined : slackClientSecret.trim() || undefined,
      workspaceId: slackWorkspaceId.trim(),
      redirectUri: slackRedirectUri.trim(),
    }),
    onSuccess: () => {
      refresh()
      showToast('Slack OAuth 已更新', 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? 'Slack OAuth 更新失敗', 'error'),
  })

  const updateAdmin = useMutation({
    mutationFn: () => {
      if (adminPassword && adminPassword !== adminPasswordConfirm) {
        throw new Error('兩次密碼不一致')
      }
      return adminApi.updateAdminAccount({
        username: adminUsername.trim(),
        password: adminPassword || undefined,
      })
    },
    onSuccess: () => {
      setAdminPassword('')
      setAdminPasswordConfirm('')
      refresh()
      showToast('管理員帳號已更新', 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '管理員帳號更新失敗', 'error'),
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">系統設定</h1>
            <p className="page-subtitle">載入中</p>
          </div>
        </div>
        <div className="card h-48 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">系統設定</h1>
          <p className="page-subtitle">設定登入、Slack OAuth 與對外 URL</p>
        </div>
      </div>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <Globe2 className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">App URLs</h2>
            <p className="text-sm text-muted">用於 Slack redirect、QR code、貼紙連結與 CORS 來源</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">Web URL</span>
            <input className="input" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="http://localhost:3000" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Admin URL</span>
            <input className="input" value={adminUrl} onChange={(e) => setAdminUrl(e.target.value)} placeholder="http://localhost:3001" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">API URL</span>
            <input className="input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://localhost:8080" />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={() => updateApp.mutate()} disabled={updateApp.isPending} className="btn-primary">
            <Save className="h-4 w-4" />
            儲存
          </button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <Slack className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">Slack OAuth</h2>
            <p className="text-sm text-muted">Slack client secret 不會顯示；留空代表不更換</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">Client ID</span>
            <input className="input" value={slackClientId} onChange={(e) => setSlackClientId(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Client Secret</span>
            <input
              className="input"
              type="password"
              value={slackClientSecret}
              onChange={(e) => setSlackClientSecret(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Workspace ID</span>
            <input className="input" value={slackWorkspaceId} onChange={(e) => setSlackWorkspaceId(e.target.value)} placeholder="TXXXXXXXX" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Redirect URI</span>
            <input className="input" value={slackRedirectUri} onChange={(e) => setSlackRedirectUri(e.target.value)} placeholder="http://localhost:8080/auth/slack/callback" />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={() => updateSlack.mutate()} disabled={updateSlack.isPending} className="btn-primary">
            <Save className="h-4 w-4" />
            儲存
          </button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">Admin 帳號</h2>
            <p className="text-sm text-muted">修改管理控制台登入帳號；密碼留空代表不更換</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">帳號</span>
            <input className="input" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">新密碼</span>
            <input className="input" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">確認新密碼</span>
            <input className="input" type="password" value={adminPasswordConfirm} onChange={(e) => setAdminPasswordConfirm(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <p className="mt-3 text-xs font-medium leading-relaxed text-muted">
          密碼至少 12 字元，需包含大小寫字母、數字、符號其中至少 3 類，且不可包含帳號或常見弱密碼字詞。
        </p>
        <div className="mt-5 flex justify-end">
          <button onClick={() => updateAdmin.mutate()} disabled={updateAdmin.isPending} className="btn-primary">
            <Save className="h-4 w-4" />
            儲存
          </button>
        </div>
      </section>
    </div>
  )
}

export const Route = createFileRoute('/settings')({ component: SettingsPage })
