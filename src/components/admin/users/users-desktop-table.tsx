import { CheckCircle, Ban } from 'lucide-react'

import { ROLE_BADGE } from '@/components/admin/users/users-role-badge'
import { UserModerationActions } from '@/components/admin/users/user-moderation-actions'
import type { UserItem } from '@/components/admin/users/users-types'
import { timeAgo } from '@/lib/format'

interface UsersDesktopTableProps {
  users: UserItem[]
  onRoleChange: (user: UserItem, role: string) => void
  onPassword: (userId: string) => void
  onBan: (userId: string) => void
  onUnban: (userId: string) => void
  onWarn: (userId: string) => void
  onDelete: (user: UserItem) => void
}

export function UsersDesktopTable({
  users,
  onRoleChange,
  onPassword,
  onBan,
  onUnban,
  onWarn,
  onDelete,
}: UsersDesktopTableProps) {
  return (
    <div className="hidden overflow-x-auto scrollbar-thin xl:block">
      <table className="w-full text-right">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-semibold">المستخدم</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">البريد</th>
            <th className="px-4 py-3 font-semibold">الدور</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">الحالة</th>
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">آخر دخول</th>
            <th className="px-4 py-3 font-semibold">إجراءات</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-white/6">
          {users.map((u) => {
            const role = ROLE_BADGE[u.role] || ROLE_BADGE.member

            const isPermBanned = u.banStatus === 'banned_perm'
            const isTempBanned =
              u.banStatus === 'banned_temp' &&
              u.bannedUntil &&
              new Date(u.bannedUntil) > new Date()

            const isBanned = Boolean(isPermBanned || isTempBanned)

            return (
              <tr key={u.id} className="text-sm transition-colors hover:bg-white/[0.03]">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {u.avatarUrl && (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-2xl object-cover"
                      />
                    )}

                    <div>
                      <div className="font-black text-white">
                        {u.username}
                      </div>

                      <div className="mt-1 text-xs text-white/35">
                        {u._count.mods} تعريب · {u._count.comments} تعليق
                      </div>
                    </div>
                  </div>
                </td>

                <td className="hidden px-4 py-3 text-xs text-white/45 md:table-cell">
                  {u.email}
                </td>

                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => onRoleChange(u, e.target.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black shadow-lg ${role.className}`}
                  >
                    <option value="member" className="bg-background text-foreground">
                      عضو
                    </option>
                    <option value="moderator" className="bg-background text-foreground">
                      مشرف
                    </option>
                    <option value="admin" className="bg-background text-foreground">
                      مدير
                    </option>
                    {u.role === 'owner' && (
                      <option value="owner" className="bg-background text-foreground">
                        مالك
                      </option>
                    )}
                  </select>
                </td>

                <td className="hidden px-4 py-3 sm:table-cell">
                  {isPermBanned ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                      <Ban className="h-3 w-3" /> حظر دائم
                    </span>
                  ) : isTempBanned ? (
                    <span className="inline-flex items-center gap-1 rounded bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                      <Ban className="h-3 w-3" /> محظور مؤقت
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
                      <CheckCircle className="h-3 w-3" /> نشط
                    </span>
                  )}
                </td>

                <td className="hidden px-4 py-3 text-xs text-white/40 lg:table-cell">
                  {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'لم يدخل بعد'}
                </td>

                <td className="px-4 py-3">
                  <UserModerationActions
                    userId={u.id}
                    isOwner={u.role === 'owner'}
                    isBanned={isBanned}
                    onPassword={() => onPassword(u.id)}
                    onBan={() => onBan(u.id)}
                    onUnban={() => onUnban(u.id)}
                    onWarn={() => onWarn(u.id)}
                    onDelete={() => onDelete(u)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
