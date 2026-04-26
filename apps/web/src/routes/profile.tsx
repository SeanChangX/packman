import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupsApi, usersApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'

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
      <h1 className="text-2xl font-bold">個人資料</h1>

      <div className="card p-6">
        <div className="flex items-center gap-4">
          {user.avatarUrl
            ? <img src={user.avatarUrl} className="h-16 w-16 rounded-full" alt={user.name} />
            : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-2xl text-white">{user.name[0]}</div>
          }
          <div>
            <p className="text-xl font-bold">{user.name}</p>
            {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
            <span className="badge mt-1 bg-gray-100 text-gray-700">{user.role}</span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">組別設定</h2>
        <div>
          <label className="label">我的組別</label>
          <select
            className="input mt-1"
            value={user.groupId ?? ''}
            onChange={(e) => updateGroup.mutate(e.target.value || null)}
            disabled={updateGroup.isPending}
          >
            <option value="">— 未分組 —</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {user.group && (
            <p className="mt-2 text-sm text-gray-500">
              目前組別: <span style={{ color: user.group.color }} className="font-medium">{user.group.name}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/profile')({ component: ProfilePage })
