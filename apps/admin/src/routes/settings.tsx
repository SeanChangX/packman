import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Save, ShieldCheck, Slack, Globe2, ImagePlus, Trash2, Sun, Moon, Monitor, Palette } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { useTheme, type ThemePreference } from '../lib/theme-context'

const themeOptions: { value: ThemePreference; label: string; icon: React.ElementType }[] = [
  { value: 'light', label: '淺色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '系統', icon: Monitor },
]

const MASKED_SECRET = '••••••••••••'

function SettingsPage() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { preference, setPreference } = useTheme()
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
  const [brandName, setBrandName] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

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
    setBrandName(settings.brand?.name ?? '')
    setBrandLogoUrl(settings.brand?.logoUrl ?? null)
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

  const updateBrand = useMutation({
    mutationFn: () => adminApi.updateBrandName(brandName),
    onSuccess: (data: { name: string; logoUrl: string | null }) => { setBrandLogoUrl(data.logoUrl); refresh(); showToast('品牌名稱已更新', 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '更新失敗', 'error'),
  })

  const uploadLogo = async (file: File) => {
    setLogoUploading(true)
    try {
      const data = await adminApi.uploadBrandLogo(file)
      setBrandLogoUrl(data.logoUrl)
      refresh()
      showToast('Logo 已上傳', 'success')
    } catch (e: unknown) {
      showToast((e as Error)?.message ?? 'Logo 上傳失敗', 'error')
    } finally {
      setLogoUploading(false)
    }
  }

  const deleteLogo = useMutation({
    mutationFn: () => adminApi.deleteBrandLogo(),
    onSuccess: () => { setBrandLogoUrl(null); refresh(); showToast('Logo 已移除', 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? '移除失敗', 'error'),
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
          <Palette className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">外觀</h2>
            <p className="text-sm text-muted">系統模式會跟隨裝置的深色 / 淺色設定</p>
          </div>
        </div>
        <label className="label">主題</label>
        <div className="mt-1 flex max-w-md rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              className={
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ' +
                (preference === value
                  ? 'bg-brand-500 text-white'
                  : 'text-muted hover:bg-white/40 dark:hover:bg-white/10')
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

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

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <ImagePlus className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">品牌識別</h2>
            <p className="text-sm text-muted">Logo 與名稱將顯示在所有貼紙的頂部</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Logo upload */}
          <div className="flex flex-col gap-3">
            <span className="label">品牌 Logo</span>
            <div className="flex items-start gap-3">
              {brandLogoUrl ? (
                <div
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
                  style={{
                    backgroundColor: '#a1a1aa',
                    backgroundImage:
                      'linear-gradient(45deg, rgba(255,255,255,0.55) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.55) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.55) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.55) 75%)',
                    backgroundSize: '12px 12px',
                    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
                  }}
                >
                  <img src={brandLogoUrl} alt="Brand logo" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-black/20 text-xs text-muted dark:border-white/20">
                  尚未上傳
                </div>
              )}
              <div className="flex min-w-36 flex-col items-stretch gap-2">
                <label className={`btn-secondary w-full cursor-pointer justify-center gap-1 text-sm ${logoUploading ? 'pointer-events-none opacity-50' : ''}`}>
                  <ImagePlus className="h-4 w-4" />
                  {logoUploading ? '上傳中...' : '上傳 Logo'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e: { target: HTMLInputElement }) => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }}
                  />
                </label>
                {brandLogoUrl && (
                  <button
                    onClick={() => deleteLogo.mutate()}
                    disabled={deleteLogo.isPending}
                    className="btn-secondary w-full justify-center gap-1 border-red-500/20 bg-red-500/10 text-sm text-red-500 hover:bg-red-500/15 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    移除
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted">支援 PNG、JPG、WebP、SVG，建議橫式，最大顯示 400×200px</p>
          </div>

          {/* Brand name */}
          <label className="flex flex-col gap-1.5">
            <span className="label">品牌名稱</span>
            <input
              className="input"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="例如：活動名稱、組織名稱"
            />
            <p className="text-xs text-muted">顯示在 Logo 旁邊；若有 Logo 可留空</p>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={() => updateBrand.mutate()} disabled={updateBrand.isPending} className="btn-primary">
            <Save className="h-4 w-4" />
            儲存
          </button>
        </div>
      </section>
    </div>
  )
}

export const Route = createFileRoute('/settings')({ component: SettingsPage })
