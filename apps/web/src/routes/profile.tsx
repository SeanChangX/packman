import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sun, Moon, Monitor } from 'lucide-react'
import { groupsApi, usersApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useTheme, type ThemePreference } from '../lib/theme-context'
import { useLocale, useT } from '../lib/i18n'
import { SUPPORTED_LOCALES, LOCALE_LABELS, type WebLocale } from '../lib/messages'
import { Select } from '../lib/select'
import { cn } from '../lib/utils'

const THEME_ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}
const THEME_ORDER: ThemePreference[] = ['light', 'dark', 'system']

function ProfilePage() {
  const { user, refetch } = useAuth()
  const qc = useQueryClient()
  const { preference, setPreference } = useTheme()
  const t = useT()
  const { preference: localePreference, setPreference: setLocalePreference } = useLocale()
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })

  const updateGroup = useMutation({
    mutationFn: (groupId: string | null) =>
      usersApi.update(user!.id, { groupId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); refetch() },
  })

  if (!user) return null

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="page-title">{t('profile.title')}</h1>
        <p className="page-subtitle">{t('profile.subtitle')}</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-4">
          {user.avatarUrl
            ? <img src={user.avatarUrl} className="h-16 w-16 rounded-full" alt={user.name} />
            : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-2xl text-white">{user.name[0]}</div>
          }
          <div>
            <p className="text-xl font-bold">{user.name}</p>
            {user.email && <p className="text-sm text-muted">{user.email}</p>}
            <span className="badge mt-1 bg-black/10 text-app dark:bg-white/10">{user.role}</span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">{t('profile.groupSettings')}</h2>
        <div>
          <label className="label">{t('profile.myGroup')}</label>
          <Select
            className="mt-1"
            value={user.groupId ?? ''}
            onChange={(v) => updateGroup.mutate(v || null)}
            placeholder={t('profile.unassigned')}
            options={[
              { value: '', label: t('profile.unassigned') },
              ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? []),
            ]}
          />
          {user.group && (
            <p className="mt-2 text-sm text-muted">
              {t('profile.currentGroup')}: <span style={{ color: user.group.color }} className="font-medium">{user.group.name}</span>
            </p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">{t('profile.appearance')}</h2>
        <label className="label">{t('profile.theme')}</label>
        <div className="mt-1 flex rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
          {THEME_ORDER.map((value) => {
            const Icon = THEME_ICONS[value]
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPreference(value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                  preference === value
                    ? 'bg-brand-500 text-white'
                    : 'text-muted hover:bg-white/40 dark:hover:bg-white/10',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`profile.theme.${value}`)}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted">{t('profile.theme.systemHint')}</p>

        <label className="label mt-5 block">{t('profile.language')}</label>
        <Select
          className="mt-1"
          value={localePreference}
          onChange={(v: WebLocale | 'system') => setLocalePreference(v)}
          options={[
            { value: 'system', label: t('profile.language.system') },
            ...SUPPORTED_LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] })),
          ]}
        />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/profile')({ component: ProfilePage })
