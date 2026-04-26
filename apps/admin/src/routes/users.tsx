import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../lib/api'
import type { User } from '@packman/shared'

function UsersPage() {
  const qc = useQueryClient()
  const { data: users, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })
  const { data: groups } = useQuery({ queryKey: ['admin-groups'], queryFn: adminApi.groups })

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; groupId?: string | null } }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const deleteUser = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">用戶管理</h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {['用戶', '組別', '角色', '加入時間', '操作'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-gray-200" /></td>
                    ))}
                  </tr>
                ))
              : users?.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {user.avatarUrl
                          ? <img src={user.avatarUrl} className="h-7 w-7 rounded-full" alt="" />
                          : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-700">{user.name[0]}</div>
                        }
                        <div>
                          <p className="font-medium">{user.name}</p>
                          {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input w-auto py-1 text-xs"
                        value={user.groupId ?? ''}
                        onChange={(e) => updateUser.mutate({
                          id: user.id,
                          data: { groupId: e.target.value || null },
                        })}
                      >
                        <option value="">— 未分組 —</option>
                        {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input w-auto py-1 text-xs"
                        value={user.role}
                        onChange={(e) => updateUser.mutate({ id: user.id, data: { role: e.target.value } })}
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-xs text-red-500 hover:text-red-700"
                        onClick={() => { if (confirm(`確定刪除用戶 ${user.name}？`)) deleteUser.mutate(user.id) }}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/users')({ component: UsersPage })
