import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ElementType } from 'react'
import { Save, ShieldCheck, Slack, Globe2, ImagePlus, Trash2, Sun, Moon, Monitor, Palette } from 'lucide-react'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { useTheme, type ThemePreference } from '../lib/theme-context'
import { useLocale, useT } from '../lib/i18n'
import { SUPPORTED_LOCALES, LOCALE_LABELS, type AdminLocale } from '../lib/messages'
import { Select } from '../lib/select'

const themeIcons: Record<ThemePreference, ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}
const themeOrder: ThemePreference[] = ['light', 'dark', 'system']

const MASKED_SECRET = '••••••••••••'

function SettingsPage() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { preference, setPreference } = useTheme()
  const t = useT()
  const { preference: preferenceLocale, setPreference: setPreferenceLocale } = useLocale()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.settings,
  })

  const [appUrl, setAppUrl] = useState('')
  const [adminUrl, setAdminUrl] = useState('')
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
    }),
    onSuccess: () => { refresh(); showToast(t('settings.appUrls.saved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('settings.appUrls.failed'), 'error'),
  })

  const updateSlack = useMutation({
    mutationFn: () => adminApi.updateSlackSettings({
      clientId: slackClientId.trim(),
      clientSecret: slackClientSecret === MASKED_SECRET ? undefined : slackClientSecret.trim() || undefined,
      workspaceId: slackWorkspaceId.trim(),
    }),
    onSuccess: () => {
      refresh()
      showToast(t('settings.slack.saved'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('settings.slack.failed'), 'error'),
  })

  const updateBrand = useMutation({
    mutationFn: () => adminApi.updateBrandName(brandName),
    onSuccess: (data: { name: string; logoUrl: string | null }) => { setBrandLogoUrl(data.logoUrl); refresh(); showToast(t('settings.brand.nameSaved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('settings.brand.updateFailed'), 'error'),
  })

  const uploadLogo = async (file: File) => {
    setLogoUploading(true)
    try {
      const data = await adminApi.uploadBrandLogo(file)
      setBrandLogoUrl(data.logoUrl)
      refresh()
      showToast(t('settings.brand.logoUploaded'), 'success')
    } catch (e: unknown) {
      showToast((e as Error)?.message ?? t('settings.brand.logoUploadFailed'), 'error')
    } finally {
      setLogoUploading(false)
    }
  }

  const deleteLogo = useMutation({
    mutationFn: () => adminApi.deleteBrandLogo(),
    onSuccess: () => { setBrandLogoUrl(null); refresh(); showToast(t('settings.brand.logoRemoved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('settings.brand.logoRemoveFailed'), 'error'),
  })

  const updateAdmin = useMutation({
    mutationFn: () => {
      if (adminPassword && adminPassword !== adminPasswordConfirm) {
        throw new Error(t('settings.admin.passwordMismatch'))
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
      showToast(t('settings.admin.saved'), 'success')
    },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('settings.admin.failed'), 'error'),
  })

  if (isLoading) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('settings.title')}</h1>
            <p className="page-subtitle">{t('common.loading')}</p>
          </div>
        </div>
        <div className="card h-48 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
      </div>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <Palette className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">{t('settings.appearance.title')}</h2>
            <p className="text-sm text-muted">{t('settings.appearance.subtitle')}</p>
          </div>
        </div>
        <label className="label">{t('settings.appearance.theme')}</label>
        <div className="mt-1 flex max-w-md rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
          {themeOrder.map((value) => {
            const Icon = themeIcons[value]
            return (
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
                {t(`settings.appearance.theme.${value}`)}
              </button>
            )
          })}
        </div>

        <label className="label mt-5 block">{t('settings.appearance.language')}</label>
        <div className="mt-1 max-w-md">
          <Select
            value={preferenceLocale}
            onChange={(v: AdminLocale | 'system') => setPreferenceLocale(v)}
            options={[
              { value: 'system', label: t('settings.appearance.language.system') },
              ...SUPPORTED_LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] })),
            ]}
          />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <Globe2 className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">{t('settings.appUrls.title')}</h2>
            <p className="text-sm text-muted">{t('settings.appUrls.subtitle')}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.appUrls.web')}</span>
            <input className="input" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="http://localhost:3000" />
            <p className="text-xs text-muted">{t('settings.appUrls.webHint')}</p>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.appUrls.admin')}</span>
            <input className="input" value={adminUrl} onChange={(e) => setAdminUrl(e.target.value)} placeholder="http://localhost:3001" />
            <p className="text-xs text-muted">{t('settings.appUrls.adminHint')}</p>
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => {
              const trimmedAdmin = adminUrl.trim()
              const currentOrigin = window.location.origin
              if (trimmedAdmin && trimmedAdmin !== currentOrigin) {
                if (!confirm(t('settings.appUrls.adminMismatchConfirm', { current: currentOrigin, next: trimmedAdmin }))) return
              }
              updateApp.mutate()
            }}
            disabled={updateApp.isPending}
            className="btn-primary"
          >
            <Save className="h-4 w-4" />
            {t('common.save')}
          </button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <Slack className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">{t('settings.slack.title')}</h2>
            <p className="text-sm text-muted">{t('settings.slack.subtitle')}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.slack.clientId')}</span>
            <input className="input" value={slackClientId} onChange={(e) => setSlackClientId(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.slack.clientSecret')}</span>
            <input
              className="input"
              type="password"
              value={slackClientSecret}
              onChange={(e) => setSlackClientSecret(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.slack.workspaceId')}</span>
            <input className="input" value={slackWorkspaceId} onChange={(e) => setSlackWorkspaceId(e.target.value)} placeholder="TXXXXXXXX" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.slack.redirectUri')}</span>
            <input className="input" value={slackRedirectUri} readOnly />
            <p className="text-xs text-muted">{t('settings.slack.redirectUriHint')}</p>
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={() => updateSlack.mutate()} disabled={updateSlack.isPending} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('common.save')}
          </button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">{t('settings.admin.title')}</h2>
            <p className="text-sm text-muted">{t('settings.admin.subtitle')}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.admin.username')}</span>
            <input className="input" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.admin.password')}</span>
            <input className="input" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.admin.passwordConfirm')}</span>
            <input className="input" type="password" value={adminPasswordConfirm} onChange={(e) => setAdminPasswordConfirm(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <p className="mt-3 text-xs font-medium leading-relaxed text-muted">
          {t('settings.admin.passwordHint')}
        </p>
        <div className="mt-5 flex justify-end">
          <button onClick={() => updateAdmin.mutate()} disabled={updateAdmin.isPending} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('common.save')}
          </button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <ImagePlus className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="text-base font-bold text-app">{t('settings.brand.title')}</h2>
            <p className="text-sm text-muted">{t('settings.brand.subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Logo upload */}
          <div className="flex flex-col gap-3">
            <span className="label">{t('settings.brand.logo')}</span>
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
                  {t('settings.brand.notUploaded')}
                </div>
              )}
              <div className="flex min-w-36 flex-col items-stretch gap-2">
                <label className={`btn-secondary w-full cursor-pointer justify-center gap-1 text-sm ${logoUploading ? 'pointer-events-none opacity-50' : ''}`}>
                  <ImagePlus className="h-4 w-4" />
                  {logoUploading ? t('settings.brand.uploading') : t('settings.brand.upload')}
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
                    {t('settings.brand.remove')}
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted">{t('settings.brand.fileHint')}</p>
          </div>

          {/* Brand name */}
          <label className="flex flex-col gap-1.5">
            <span className="label">{t('settings.brand.name')}</span>
            <input
              className="input"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={t('settings.brand.namePlaceholder')}
            />
            <p className="text-xs text-muted">{t('settings.brand.nameHint')}</p>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={() => updateBrand.mutate()} disabled={updateBrand.isPending} className="btn-primary">
            <Save className="h-4 w-4" />
            {t('common.save')}
          </button>
        </div>
      </section>
    </div>
  )
}

export const Route = createFileRoute('/settings')({ component: SettingsPage })
