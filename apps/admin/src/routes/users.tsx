import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@packman/ui'
import { adminApi } from '../lib/api'
import { Select } from '../lib/select'
import { useT } from '../lib/i18n'
import type { User } from '@packman/shared'

function UsersPage() {
  const t = useT()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { data: users, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users, staleTime: 30_000 })
  const { data: groups } = useQuery({ queryKey: ['admin-groups'], queryFn: adminApi.groups, staleTime: 30_000 })

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; groupId?: string | null } }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); showToast(t('users.update.saved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('users.update.failed'), 'error'),
  })

  const deleteUser = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); showToast(t('users.delete.saved'), 'success') },
    onError: (e: unknown) => showToast((e as Error)?.message ?? t('users.delete.failed'), 'error'),
  })

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('users.title')}</h1>
          <p className="page-subtitle">{t('users.subtitle')}</p>
        </div>
      </div>

      <div className="card table-shell">
        <div className="table-scroll">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <tr>
                {[t('users.column.user'), t('users.column.group'), t('users.column.role'), t('users.column.joinedAt'), t('common.actions')].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-white/10" /></td>
                      ))}
                    </tr>
                  ))
                : users?.map((user) => (
                    <tr key={user.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="min-w-48 px-4 py-3">
                        <div className="flex items-center gap-2">
                          {user.avatarUrl
                            ? <img src={user.avatarUrl} className="h-7 w-7 rounded-full" alt="" />
                            : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs text-white">{user.name[0]}</div>
                          }
                          <div className="min-w-0">
                            <p className="font-medium">{user.name}</p>
                            {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          className="w-48"
                          value={user.groupId ?? ''}
                          onChange={(value) => updateUser.mutate({
                            id: user.id,
                            data: { groupId: value || null },
                          })}
                          options={[{ value: '', label: t('users.group.unassigned') }, ...(groups?.map((g) => ({ value: g.id, label: g.name })) ?? [])]}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          className="w-36"
                          value={user.role}
                          onChange={(value) => updateUser.mutate({ id: user.id, data: { role: value } })}
                          options={[
                            { value: 'MEMBER', label: t('users.role.member') },
                            { value: 'ADMIN', label: t('users.role.admin') },
                          ]}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                        {new Date(user.createdAt).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="w-20 whitespace-nowrap px-4 py-3">
                        <button
                          className="whitespace-nowrap text-xs font-semibold text-brand-600 hover:text-brand-700"
                          onClick={() => { if (confirm(t('users.delete.confirm', { name: user.name }))) deleteUser.mutate(user.id) }}
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/users')({ component: UsersPage })
