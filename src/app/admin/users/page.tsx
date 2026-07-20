'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Crown, Shield, Star, User as UserIcon, Trash2, Plus, Search, Key, Ban, CheckCircle, AlertTriangle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'

interface UserItem {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  bio: string | null
  role: string
  bannedUntil: string | null
  banStatus: string | null
  banReason: string | null
  bannedAt: string | null
  lastLoginAt: string | null
  loginCount: number
  joinedAt: string
  _count: { mods: number; comments: number; endorsements: number }
}

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  owner:     { label: 'مالك', icon: <Crown className="h-3 w-3" />, className: 'bg-amber-500 text-white' },
  admin:     { label: 'مدير',  icon: <Shield className="h-3 w-3" />, className: 'bg-red-500 text-white' },
  moderator: { label: 'مشرف',  icon: <Star className="h-3 w-3" />,  className: 'bg-purple-500 text-white' },
  member:    { label: 'عضو',   icon: <UserIcon className="h-3 w-3" />, className: 'bg-blue-500 text-white' },
}

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

  // نموذج إضافة مستخدم
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('member')

  // نموذج تغيير كلمة المرور
  const [changePwUserId, setChangePwUserId] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')

  // نموذج الحظر
  const [banUserId, setBanUserId] = useState<string | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState<'permanent' | 'temp'>('permanent')
  const [banDays, setBanDays] = useState(7)
  const [banIp, setBanIp] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '50')
    if (search) params.set('search', search)
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (bannedFilter !== 'all') params.set('banned', bannedFilter)

    fetch(`/api/admin/users?${params.toString()}`)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => { setUsers(data.users || []); setTotalPages(data.totalPages || 1) })
      .catch(() => setError('فشل تحميل المستخدمين'))
      .finally(() => setLoading(false))
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
      setUsers((p) => p.map((u) => u.id === user.id ? { ...u, role: newRole } : u))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onChangePassword = async (userId: string) => {
    if (!newPw || newPw.length < 6) {
      toast({ title: 'كلمة المرور قصيرة', description: 'يجب أن تكون 6 أحرف على الأقل', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل التحديث')
      toast({ title: 'تم التحديث', description: 'تم تغيير كلمة المرور بنجاح' })
      setChangePwUserId(null); setNewPw('')
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onBan = async () => {
    if (!banUserId) return
    try {
      const res = await fetch(`/api/admin/users/${banUserId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: banDuration === 'temp' ? 'temp' : 'perm',
          days: banDays,
          reason: banReason,
          banIp,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الحظر')
      toast({
        title: 'تم الحظر',
        description: banIp && data.ipBanned ? 'تم حظر المستخدم وعنوان IP' : 'تم حظر المستخدم',
      })
      setUsers((p) => p.map((u) => u.id === banUserId ? {
        ...u,
        bannedUntil: data.bannedUntil,
        banStatus: data.banStatus,
        banReason: data.banReason,
        bannedAt: new Date().toISOString(),
      } : u))
      setBanUserId(null); setBanReason(''); setBanIp(false)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
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
      setUsers((p) => p.map((u) => u.id === userId ? {
        ...u,
        bannedUntil: null,
        banStatus: 'active',
        banReason: null,
        bannedAt: null,
      } : u))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
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
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onDelete = async (user: UserItem) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${user.username}"؟`)) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); throw new Error(data?.error || 'فشل الحذف') }
      toast({ title: 'تم الحذف' })
      setUsers((p) => p.filter((u) => u.id !== user.id))
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onAddUser = async () => {
    if (!newUsername || !newEmail || !newPassword) { toast({ title: 'بيانات ناقصة', variant: 'destructive' }); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) { toast({ title: 'بريد غير صالح', variant: 'destructive' }); return }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, email: newEmail, password: newPassword, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الإنشاء')
      toast({ title: 'تم الإنشاء' })
      setUsers((p) => [{ ...data.user, _count: { mods: 0, comments: 0, endorsements: 0 }, lastLoginAt: null, loginCount: 0, bannedUntil: null, joinedAt: new Date().toISOString() } as UserItem, ...p])
      setNewUsername(''); setNewEmail(''); setNewPassword(''); setNewRole('member')
      setShowAddForm(false)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="grid place-items-center py-20 text-center"><p className="text-sm text-destructive">{error}</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المستخدمون</h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} مستخدم</p>
        </div>
        <Button onClick={() => setShowAddForm((s) => !s)}>
          <Plus className="ml-2 h-4 w-4" /> إضافة مستخدم
        </Button>
      </div>

      {/* الفلاتر */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="ابحث بالاسم أو البريد..." className="h-10 pr-10" />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
          <option value="all">كل الأدوار</option>
          <option value="owner">مالك</option>
          <option value="admin">مدير</option>
          <option value="moderator">مشرف</option>
          <option value="member">عضو</option>
        </select>
        <select value={bannedFilter} onChange={(e) => { setBannedFilter(e.target.value); setPage(1) }} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
          <option value="all">الكل</option>
          <option value="active">نشط</option>
          <option value="banned">محظور</option>
        </select>
      </div>

      {/* نموذج إضافة */}
      {showAddForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <h3 className="text-sm font-bold">إضافة مستخدم جديد</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label>اسم المستخدم</Label><Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} /></div>
            <div><Label>البريد الإلكتروني</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div><Label>كلمة المرور</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div>
              <Label>الدور</Label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                <option value="member">عضو</option>
                <option value="moderator">مشرف</option>
                <option value="admin">مدير</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>إلغاء</Button>
            <Button onClick={onAddUser}>إنشاء</Button>
          </div>
        </div>
      )}

      {/* القائمة */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-right">
          <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">المستخدم</th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">البريد</th>
              <th className="px-4 py-3 font-semibold">الدور</th>
              <th className="hidden px-4 py-3 font-semibold sm:table-cell">الحالة</th>
              <th className="hidden px-4 py-3 font-semibold lg:table-cell">آخر دخول</th>
              <th className="px-4 py-3 font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const role = ROLE_BADGE[u.role] || ROLE_BADGE.member
              const isPermBanned = u.banStatus === 'banned_perm'
              const isTempBanned = u.banStatus === 'banned_temp'
                && u.bannedUntil
                && new Date(u.bannedUntil) > new Date()
              const isBanned = isPermBanned || isTempBanned
              return (
                <tr key={u.id} className="text-sm transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl && <img src={u.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                      <span className="font-medium">{u.username}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => onRoleChange(u, e.target.value)}
                      className={`rounded px-2 py-1 text-xs font-bold ${role.className}`}
                    >
                      <option value="member" className="bg-background text-foreground">عضو</option>
                      <option value="moderator" className="bg-background text-foreground">مشرف</option>
                      <option value="admin" className="bg-background text-foreground">مدير</option>
                      {u.role === 'owner' && <option value="owner" className="bg-background text-foreground">مالك</option>}
                    </select>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {isPermBanned ? (
                      <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400" title={u.banReason || undefined}>
                        <Ban className="h-3 w-3" /> حظر دائم
                      </span>
                    ) : isTempBanned ? (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400" title={u.banReason || undefined}>
                        <Ban className="h-3 w-3" /> محظور مؤقت
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
                        <CheckCircle className="h-3 w-3" /> نشط
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'لم يدخل بعد'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/users/${u.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="عرض التفاصيل">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setChangePwUserId(u.id); setNewPw('') }} title="تغيير كلمة المرور">
                        <Key className="h-4 w-4" />
                      </Button>
                      {u.role !== 'owner' && (
                        <>
                          {isBanned ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-400 hover:bg-green-500/10" onClick={() => onUnban(u.id)} title="إلغاء الحظر">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-400 hover:bg-orange-500/10" onClick={() => { setBanUserId(u.id); setBanReason(''); setBanIp(false) }} title="حظر">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-yellow-400 hover:bg-yellow-500/10" onClick={() => onWarn(u.id)} title="تحذير">
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-500" onClick={() => onDelete(u)} title="حذف">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      )}

      {/* Modal تغيير كلمة المرور */}
      {changePwUserId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => setChangePwUserId(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-bold">تغيير كلمة المرور</h3>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="كلمة المرور الجديدة" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') onChangePassword(changePwUserId) }} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setChangePwUserId(null)}>إلغاء</Button>
              <Button size="sm" onClick={() => onChangePassword(changePwUserId)}>حفظ</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal الحظر */}
      {banUserId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => { setBanUserId(null); setBanIp(false) }}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-bold">حظر المستخدم</h3>
            <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="سبب الحظر (اختياري)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" rows={2} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={banDuration === 'permanent'} onChange={() => setBanDuration('permanent')} />
                دائم
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={banDuration === 'temp'} onChange={() => setBanDuration('temp')} />
                مؤقت
              </label>
              {banDuration === 'temp' && (
                <label className="flex items-center gap-1 text-sm">
                  <Input type="number" value={banDays} onChange={(e) => setBanDays(Number(e.target.value))} className="h-8 w-20" min={1} />
                  يوم
                </label>
              )}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={banIp} onChange={(e) => setBanIp(e.target.checked)} className="rounded" />
              حظر عنوان IP أيضاً (منع إنشاء حسابات جديدة من نفس الجهاز)
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setBanUserId(null); setBanIp(false) }}>إلغاء</Button>
              <Button size="sm" variant="destructive" onClick={onBan}>حظر</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
