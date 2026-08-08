'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { UsersHero } from '@/components/admin/users/users-hero'
import { ModerationSummary } from '@/components/admin/users/moderation-summary'
import { UsersFilters } from '@/components/admin/users/users-filters'
import { UsersDesktopTable } from '@/components/admin/users/users-desktop-table'
import { UsersMobileCards } from '@/components/admin/users/users-mobile-cards'
import { AddUserModal } from '@/components/admin/users/add-user-modal'
import { PasswordModal } from '@/components/admin/users/password-modal'
import { BanModal } from '@/components/admin/users/ban-modal'
import type { UserItem } from '@/components/admin/users/users-types'

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
        setUsers(data.users || [])
        setTotalPages(data.totalPages || 1)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError('فشل تحميل المستخدمين')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [page, search, roleFilter, bannedFilter])

  const onRoleChange = async (user: UserItem, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل التحديث')
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
      if (!res.ok) throw new Error(data?.error || 'فشل التحديث')
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
          data.banIp && result.ipBanned
            ? 'تم حظر المستخدم وعنوان IP'
            : 'تم حظر المستخدم',
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
      if (!res.ok) throw new Error(data?.error || 'فشل إلغاء الحظر')
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

  const onWarn = async (userId: string) => {
    const reason = prompt('سبب التحذير (اختياري):')
    try {
      const res = await fetch(`/api/admin/users/${userId}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error('فشل التحذير')
      toast({ title: 'تم التحذير' })
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onDelete = async (user: UserItem) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${user.username}"؟`)) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'فشل الحذف')
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

  if (loading)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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
          <p className="mt-2 text-sm text-white/50">
            مراقبة الحسابات وإدارة الصلاحيات والنشاط.
          </p>
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

      {showAddForm && (
        <AddUserModal onClose={() => setShowAddForm(false)} onSubmit={onAddUser} />
      )}

      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#111214]/90">
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
        />

        <UsersMobileCards
          users={users}
          onPassword={(userId) => setChangePwUserId(userId)}
          onBan={(userId) => setBanUserId(userId)}
          onUnban={onUnban}
          onWarn={onWarn}
          onDelete={onDelete}
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
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
        <BanModal
          userId={banUserId}
          onClose={() => setBanUserId(null)}
          onSubmit={onBan}
        />
      )}
    </div>
  )
}
