import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sun, Moon, Monitor } from 'lucide-react'
import { groupsApi, usersApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useTheme, type ThemePreference } from '../lib/theme-context'
import { Select } from '../lib/select'
import { cn } from '../lib/utils'

const themeOptions: { value: ThemePreference; label: string; icon: React.ElementType }[] = [
  { value: 'light', label: '淺色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '系統', icon: Monitor },
]

function ProfilePage() {
  const { user, refetch } = useAuth()
  const qc = useQueryClient()
  const { preference, setPreference } = useTheme()
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
        <h1 className="page-title">個人資料</h1>
        <p className="page-subtitle">Slack 帳號與組別設定</p>
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
        <h2 className="mb-4 font-semibold">組別設定</h2>
        <div>
          <label className="label">我的組別</label>
          <Select
            className="mt-1"
            value={user.groupId ?? ''}
            onChange={(v) => updateGroup.mutate(v || null)}
            placeholder="— 未分組 —"
            options={[
              { value: '', label: '— 未分組 —' },
              ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? []),
            ]}
          />
          {user.group && (
            <p className="mt-2 text-sm text-muted">
              目前組別: <span style={{ color: user.group.color }} className="font-medium">{user.group.name}</span>
            </p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">外觀</h2>
        <label className="label">主題</label>
        <div className="mt-1 flex rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
          {themeOptions.map(({ value, label, icon: Icon }) => (
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
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">系統模式會跟隨裝置的深色 / 淺色設定。</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/profile')({ component: ProfilePage })
