// Updated for new API response format
'use client'

import { AlertTriangle, Ban, CheckCircle, Eye, Key, Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AddUserModal } from '@/components/admin/users/add-user-modal'
import { BanModal } from '@/components/admin/users/ban-modal'
import { EditUserDialog } from '@/components/admin/users/edit-user-dialog'
import { ModerationSummary } from '@/components/admin/users/moderation-summary'
import { PasswordModal } from '@/components/admin/users/password-modal'
import { UsersDesktopTable } from '@/components/admin/users/users-desktop-table'
import { UsersFilters } from '@/components/admin/users/users-filters'
import { UsersHero } from '@/components/admin/users/users-hero'
import { ROLE_BADGE } from '@/components/admin/users/users-role-badge'
import type { UserItem } from '@/components/admin/users/users-types'
import { WarningDialog } from '@/components/admin/users/warning-dialog'
import { TierBadge } from '@/components/tier-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTableSkeleton } from '@/components/ui/data-skeleton'
import { useToast } from '@/hooks/use-toast'

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [bannedFilter, setBannedFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const [changePwUserId, setChangePwUserId] = useState<string | null>(null)
  const [banUserId, setBanUserId] = useState<string | null>(null)
  const [warningUser, setWarningUser] = useState<{ id: string; username: string } | null>(null)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '50')
    if (search) params.set('search', search)
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (bannedFilter !== 'all') params.set('banned', bannedFilter)

    setLoading(true)
    setError(null)

    fetch(`/api/admin/users?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        setUsers(data.data || [])
        setTotalPages(data.pagination.totalPages || 1)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError('فشل تحميل المستخدمين')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [page, search, roleFilter, bannedFilter, refreshKey])

  const onRoleChange = async (user: UserItem, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل التحديث',
        )
      toast({ title: 'تم التحديث', description: `تم تغيير دور ${user.username}` })
      setUsers((p) => p.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)))
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onChangePassword = async (userId: string, password: string) => {
    if (!password || password.length < 6) {
      toast({
        title: 'كلمة المرور قصيرة',
        description: 'يجب أن تكون 6 أحرف على الأقل',
        variant: 'destructive',
      })
      return
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل التحديث',
        )
      toast({ title: 'تم التحديث', description: 'تم تغيير كلمة المرور بنجاح' })
      setChangePwUserId(null)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onBan = async (data: {
    userId: string
    reason: string
    duration: 'permanent' | 'temp'
    days: number
    banIp: boolean
  }) => {
    try {
      const res = await fetch(`/api/admin/users/${data.userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.duration === 'temp' ? 'temp' : 'perm',
          days: data.days,
          reason: data.reason,
          banIp: data.banIp,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'فشل الحظر')
      toast({
        title: 'تم الحظر',
        description:
          data.banIp && result.ipBanned ? 'تم حظر المستخدم وعنوان IP' : 'تم حظر المستخدم',
      })
      setUsers((p) =>
        p.map((u) =>
          u.id === data.userId
            ? {
                ...u,
                bannedUntil: result.bannedUntil,
                banStatus: result.banStatus,
                banReason: result.banReason,
                bannedAt: new Date().toISOString(),
              }
            : u,
        ),
      )
      setBanUserId(null)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onUnban = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearIp: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل إلغاء الحظر',
        )
      toast({
        title: 'تم إلغاء الحظر',
        description: data.ipCleared ? 'تم إزالة حظر IP المرتبط أيضاً' : undefined,
      })
      setUsers((p) =>
        p.map((u) =>
          u.id === userId
            ? {
                ...u,
                bannedUntil: null,
                banStatus: 'active',
                banReason: null,
                bannedAt: null,
              }
            : u,
        ),
      )
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onWarn = (userId: string) => {
    const u = users.find((x) => x.id === userId)
    if (u) setWarningUser({ id: u.id, username: u.username })
  }

  const onDelete = async (user: UserItem) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${user.username}"؟`)) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل الحذف',
        )
      }
      toast({ title: 'تم الحذف' })
      setUsers((p) => p.filter((u) => u.id !== user.id))
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onAddUser = async (data: {
    username: string
    email: string
    password: string
    role: string
  }) => {
    if (!data.username || !data.email || !data.password) {
      toast({ title: 'بيانات ناقصة', variant: 'destructive' })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      toast({ title: 'بريد غير صالح', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'فشل الإنشاء')
      toast({ title: 'تم الإنشاء' })
      setUsers((p) => [
        {
          ...result.user,
          _count: { mods: 0, comments: 0, endorsements: 0 },
          lastLoginAt: null,
          loginCount: 0,
          bannedUntil: null,
          joinedAt: new Date().toISOString(),
        } as UserItem,
        ...p,
      ])
      setShowAddForm(false)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  if (loading) return <DataTableSkeleton rows={5} cols={7} />
  if (error)
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )

  const bannedUsers = users.filter((u) => u.banStatus?.startsWith('banned')).length
  const moderators = users.filter((u) => u.role === 'moderator').length
  const admins = users.filter((u) => u.role === 'admin').length
  const recentlyActive = users.filter((u) => {
    if (!u.lastLoginAt) return false
    const lastLogin = new Date(u.lastLoginAt).getTime()
    return Date.now() - lastLogin < 1000 * 60 * 60 * 24 * 7
  }).length

  return (
    <div className="space-y-8">
      <UsersHero totalUsers={users.length} bannedUsers={bannedUsers} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">إدارة المجتمع</h2>
          <p className="mt-2 text-sm text-white/65">مراقبة الحسابات وإدارة الصلاحيات والنشاط.</p>
        </div>

        <Button
          onClick={() => setShowAddForm(true)}
          className="h-12 rounded-2xl px-6 text-sm font-black shadow-lg shadow-primary/20"
        >
          <Plus className="ml-2 h-4 w-4" /> إضافة مستخدم
        </Button>
      </div>

      <ModerationSummary
        recentlyActive={recentlyActive}
        bannedUsers={bannedUsers}
        moderators={moderators}
        admins={admins}
      />

      <UsersFilters
        search={search}
        roleFilter={roleFilter}
        bannedFilter={bannedFilter}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        onRoleChange={(value) => {
          setRoleFilter(value)
          setPage(1)
        }}
        onBannedChange={(value) => {
          setBannedFilter(value)
          setPage(1)
        }}
      />

      {showAddForm && <AddUserModal onClose={() => setShowAddForm(false)} onSubmit={onAddUser} />}

      {/* Desktop table - visible from md and up */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
        <UsersDesktopTable
          users={users}
          onRoleChange={onRoleChange}
          onPassword={(userId) => {
            setChangePwUserId(userId)
          }}
          onBan={(userId) => setBanUserId(userId)}
          onUnban={onUnban}
          onWarn={onWarn}
          onDelete={onDelete}
          onEdit={(user) => setEditingUser(user)}
        />
      </div>

      {/* Mobile cards - visible only below md */}
      <div className="md:hidden space-y-3">
        {users.map((u) => {
          const role = ROLE_BADGE[u.role] || ROLE_BADGE.member
          const isPermBanned = u.banStatus === 'banned_perm'
          const isTempBanned =
            u.banStatus === 'banned_temp' && u.bannedUntil && new Date(u.bannedUntil) > new Date()
          const isBanned = Boolean(isPermBanned || isTempBanned)
          return (
            <Card key={u.id} className="overflow-hidden">
              <CardContent className="p-4">
                {/* avatar + username + role Badge */}
                <div className="flex items-start gap-3">
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-sm font-black text-primary">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black text-white">{u.username}</h3>
                      <Badge
                        className={`gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${role.className}`}
                      >
                        {role.icon}
                        {role.label}
                      </Badge>
                      <TierBadge tier={u.tier || 0} role={u.role} size="sm" />
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
                    </div>
                    {/* email */}
                    <p className="mt-1.5 truncate text-sm text-muted-foreground" dir="ltr">
                      {u.email}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{u._count.mods} تعريب</span>
                      <span>•</span>
                      <span>{u._count.comments} تعليق</span>
                    </div>
                  </div>
                </div>

                {/* actions - same as table, touch-friendly min-h-[44px] */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-background-secondary px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary"
                  >
                    <Eye className="h-4 w-4" />
                    التفاصيل
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] rounded-md border border-border bg-background-secondary"
                    onClick={() => setEditingUser(u)}
                  >
                    <Pencil className="ml-2 h-4 w-4" />
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] rounded-md border border-border bg-background-secondary"
                    onClick={() => setChangePwUserId(u.id)}
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
                          onClick={() => setBanUserId(u.id)}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}

      {changePwUserId && (
        <PasswordModal
          userId={changePwUserId}
          onClose={() => setChangePwUserId(null)}
          onSubmit={onChangePassword}
        />
      )}

      {banUserId && (
        <BanModal userId={banUserId} onClose={() => setBanUserId(null)} onSubmit={onBan} />
      )}

      {warningUser && (
        <WarningDialog
          open={!!warningUser}
          onOpenChange={(open) => !open && setWarningUser(null)}
          userId={warningUser.id}
          username={warningUser.username}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  )
}
