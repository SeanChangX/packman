import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupsApi, usersApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { Select } from '../lib/select'

function ProfilePage() {
  const { user, refetch } = useAuth()
  const qc = useQueryClient()
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })

  const updateGroup = useMutation({
    mutationFn: (groupId: string | null) =>
      usersApi.update(user!.id, { groupId: groupId ?? undefined }),
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
    </div>
  )
}

export const Route = createFileRoute('/profile')({ component: ProfilePage })
