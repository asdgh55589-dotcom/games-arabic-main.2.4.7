'use client'

import { AlertTriangle, Ban, CheckCircle, Eye, Key, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { ROLE_BADGE } from '@/components/admin/users/users-role-badge'
import type { UserItem } from '@/components/admin/users/users-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface UsersMobileCardsProps {
  users: UserItem[]
  onPassword: (userId: string) => void
  onBan: (userId: string) => void
  onUnban: (userId: string) => void
  onWarn: (userId: string) => void
  onDelete: (user: UserItem) => void
}

export function UsersMobileCards({
  users,
  onPassword,
  onBan,
  onUnban,
  onWarn,
  onDelete,
}: UsersMobileCardsProps) {
  return (
    <div className="space-y-3">
      {users.map((u) => {
        const role = ROLE_BADGE[u.role] || ROLE_BADGE.member

        const isPermBanned = u.banStatus === 'banned_perm'
        const isTempBanned =
          u.banStatus === 'banned_temp' && u.bannedUntil && new Date(u.bannedUntil) > new Date()
        const isBanned = Boolean(isPermBanned || isTempBanned)

        return (
          <Card key={u.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {u.avatarUrl && (
                  <Image
                    unoptimized
                    loading="lazy"
                    width={56}
                    height={56}
                    src={u.avatarUrl}
                    alt=""
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black text-white">
                      {u.displayName || u.username}
                    </h3>
                    {u.displayName && (
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${role.className}`}
                    >
                      {role.icon}
                      {role.label}
                    </span>

                    {isPermBanned && (
                      <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                        <Ban className="h-3 w-3" /> حظر دائم
                      </span>
                    )}
                    {isTempBanned && (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                        <Ban className="h-3 w-3" /> محظور مؤقت
                      </span>
                    )}
                    {!isBanned && (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
                        <CheckCircle className="h-3 w-3" /> نشط
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">{u.email}</p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{u._count.mods} تعريب</span>
                    <span>•</span>
                    <span>{u._count.comments} تعليق</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-background-secondary px-3 py-2 text-sm font-medium text-muted-foreground"
                >
                  <Eye className="h-4 w-4" />
                  التفاصيل
                </Link>

                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] rounded-md border border-border bg-background-secondary"
                  onClick={() => onPassword(u.id)}
                >
                  <Key className="ml-2 h-4 w-4" />
                  كلمة المرور
                </Button>

                {u.role !== 'owner' && (
                  <>
                    {isBanned ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px] rounded-xl border-green-500/20 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                        onClick={() => onUnban(u.id)}
                      >
                        <CheckCircle className="ml-2 h-4 w-4" />
                        إلغاء الحظر
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px] rounded-xl border-orange-500/20 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20"
                        onClick={() => onBan(u.id)}
                      >
                        <Ban className="ml-2 h-4 w-4" />
                        حظر
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] rounded-xl border-yellow-500/20 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"
                      onClick={() => onWarn(u.id)}
                    >
                      <AlertTriangle className="ml-2 h-4 w-4" />
                      تحذير
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] rounded-xl border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      onClick={() => onDelete(u)}
                    >
                      <Trash2 className="ml-2 h-4 w-4" />
                      حذف
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
