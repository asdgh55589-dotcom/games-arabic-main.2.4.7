'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Eye,
  UserCog,
  TrendingUp,
  TrendingDown,
  Ban,
  CheckCircle,
  AlertTriangle,
  Key,
  Trash2,
  Activity,
  Bell,
  History,
  Crown,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { ROLE_ORDER, hasRoleAtLeast, getRoleLabel, type UserRole } from '@/lib/roles'

// ===== Types (بدون اختصار) =====
export type UserActionType =
  | 'viewProfile'
  | 'changeRole'
  | 'promote'
  | 'demote'
  | 'ban'
  | 'unban'
  | 'warn'
  | 'resetPassword'
  | 'delete'
  | 'viewActivity'
  | 'sendNotification'
  | 'viewTierHistory'
  | 'transferOwnership'

export interface ManagedUser {
  id: string
  username: string
  email: string
  avatarUrl?: string | null
  role: string
  tier?: number
  specialRoles?: string | null
  banStatus?: string | null
  bannedUntil?: string | null
  banReason?: string | null
  createdAt?: string
  lastLoginAt?: string | null
  _count?: { mods: number; comments: number; reviews?: number }
}

export interface UserActionsProps {
  user: ManagedUser
  currentUser: { id: string; role: string; username: string }
  onActionComplete: () => void
  availableActions?: UserActionType[]
}

const ROLE_LABELS_AR: Record<string, string> = {
  member: 'عضو',
  creator: 'مُعَرِّب',
  publisher: 'ناشر',
  moderator: 'مشرف',
  admin: 'مسؤول',
  manager: 'مدير',
  owner: 'مالك الموقع',
}

export function UserActions({ user, currentUser, onActionComplete, availableActions }: UserActionsProps) {
  const { toast } = useToast()
  const [openDialog, setOpenDialog] = useState<UserActionType | null>(null)
  const [loading, setLoading] = useState(false)
  // form states
  const [newRole, setNewRole] = useState(user.role)
  const [banType, setBanType] = useState<'perm' | 'temp'>('perm')
  const [banDays, setBanDays] = useState(7)
  const [banReason, setBanReason] = useState('')
  const [banIp, setBanIp] = useState(false)
  const [warnReason, setWarnReason] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forceLogout, setForceLogout] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [notifPriority, setNotifPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [transferConfirm, setTransferConfirm] = useState('')

  const isSelf = currentUser.id === user.id
  const currentRoleIndex = ROLE_ORDER.indexOf(currentUser.role as UserRole)
  const targetRoleIndex = ROLE_ORDER.indexOf(user.role as UserRole)
  const canManage = !isSelf && currentRoleIndex > targetRoleIndex
  const isOwner = currentUser.role === 'owner'
  const isAdminPlus = hasRoleAtLeast(currentUser.role, 'admin')
  const isBanned = user.banStatus === 'banned_perm' || (user.banStatus === 'banned_temp' && user.bannedUntil && new Date(user.bannedUntil) > new Date())

  const isActionEnabled = (action: UserActionType) => {
    if (availableActions && !availableActions.includes(action)) return false
    switch (action) {
      case 'viewProfile':
      case 'viewActivity':
      case 'viewTierHistory':
        return true
      case 'changeRole':
      case 'promote':
      case 'demote':
        return isAdminPlus && canManage
      case 'ban':
        return canManage && !isBanned
      case 'unban':
        return canManage && !!isBanned
      case 'warn':
        return canManage
      case 'resetPassword':
        return isAdminPlus && !isSelf
      case 'delete':
        return canManage && user.role !== 'owner' && !isSelf
      case 'sendNotification':
        return isAdminPlus
      case 'transferOwnership':
        return isOwner && user.role !== 'owner'
      default:
        return true
    }
  }

  const getNextRole = (): string | null => {
    const idx = ROLE_ORDER.indexOf(user.role as UserRole)
    if (idx === -1 || idx >= ROLE_ORDER.length - 1) return null
    return ROLE_ORDER[idx + 1]
  }
  const getPrevRole = (): string | null => {
    const idx = ROLE_ORDER.indexOf(user.role as UserRole)
    if (idx <= 0) return null
    return ROLE_ORDER[idx - 1]
  }

  // ===== API handlers =====
  const handleChangeRole = async () => {
    if (!newRole || newRole === user.role) {
      toast({ title: 'لم يتم تغيير الدور', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'فشل تغيير الدور')
      toast({ title: 'تم تغيير الدور بنجاح', description: `أصبح ${user.username} بدور ${getRoleLabel(newRole)}` })
      setOpenDialog(null)
      onActionComplete()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handlePromoteDemote = async (target: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: target }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'فشل')
      toast({ title: target === getNextRole() ? 'تمت الترقية بنجاح' : 'تم التنزيل بنجاح' })
      setOpenDialog(null)
      onActionComplete()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleBan = async () => {
    if (!banReason.trim()) {
      toast({ title: 'سبب الحظر مطلوب', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: banType, days: banDays, reason: banReason, banIp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الحظر')
      toast({ title: 'تم الحظر بنجاح', description: banIp && data.ipBanned ? 'تم حظر المستخدم وعنوان IP' : undefined })
      setOpenDialog(null)
      setBanReason('')
      onActionComplete()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleUnban = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearIp: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error?.message || 'فشل')
      toast({ title: 'تم إلغاء الحظر' })
      setOpenDialog(null)
      onActionComplete()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleWarn = async () => {
    if (!warnReason.trim()) {
      toast({ title: 'سبب التحذير مطلوب', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: warnReason }),
      })
      if (!res.ok) throw new Error('فشل التحذير')
      toast({ title: 'تم إرسال التحذير' })
      setOpenDialog(null)
      setWarnReason('')
      onActionComplete()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'كلمة المرور قصيرة (6 أحرف على الأقل)', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, forceLogout }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'فشل')
      toast({ title: 'تم تغيير كلمة المرور بنجاح' })
      setOpenDialog(null)
      setNewPassword('')
      onActionComplete()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== user.username) {
      toast({ title: `اكتب "${user.username}" للتأكيد`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message || 'فشل الحذف')
      }
      toast({ title: 'تم حذف المستخدم بنجاح' })
      setOpenDialog(null)
      onActionComplete()
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      toast({ title: 'العنوان والمحتوى مطلوبان', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: notifTitle, message: notifBody, priority: notifPriority }),
      })
      // fallback to admin notify if endpoint differs
      if (!res.ok) {
        const alt = await fetch(`/api/admin/users/${user.id}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: notifTitle, message: notifBody }),
        })
        if (!alt.ok) throw new Error('فشل الإرسال')
      }
      toast({ title: 'تم إرسال الإشعار بنجاح' })
      setOpenDialog(null)
      setNotifTitle('')
      setNotifBody('')
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let p = ''
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)]
    setNewPassword(p)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[44px] min-w-[44px]" aria-label="إجراءات المستخدم">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">إجراءات — {user.username}</DropdownMenuLabel>

          {/* عرض */}
          <DropdownMenuItem asChild disabled={!isActionEnabled('viewProfile')}>
            <Link href={`/admin/users/${user.id}`} className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> عرض الملف الشخصي
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('viewActivity')} disabled={!isActionEnabled('viewActivity')}>
            <Activity className="h-4 w-4" /> عرض النشاط
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('viewTierHistory')} disabled={!isActionEnabled('viewTierHistory')}>
            <History className="h-4 w-4" /> عرض سجل المستوى
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          {/* إدارة الأدوار */}
          <DropdownMenuLabel className="text-xs">إدارة الدور</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setOpenDialog('changeRole')} disabled={!isActionEnabled('changeRole')}>
            <UserCog className="h-4 w-4" /> تغيير الدور
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('promote')} disabled={!isActionEnabled('promote') || !getNextRole()}>
            <TrendingUp className="h-4 w-4" /> ترقية إلى {getNextRole() ? ROLE_LABELS_AR[getNextRole()!] : '—'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('demote')} disabled={!isActionEnabled('demote') || !getPrevRole()}>
            <TrendingDown className="h-4 w-4" /> تنزيل إلى {getPrevRole() ? ROLE_LABELS_AR[getPrevRole()!] : '—'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">إجراءات أمنية</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setOpenDialog('ban')} disabled={!isActionEnabled('ban')}>
            <Ban className="h-4 w-4" /> حظر المستخدم
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('unban')} disabled={!isActionEnabled('unban')}>
            <CheckCircle className="h-4 w-4" /> إلغاء الحظر
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('warn')} disabled={!isActionEnabled('warn')}>
            <AlertTriangle className="h-4 w-4" /> إرسال تحذير
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog('resetPassword')} disabled={!isActionEnabled('resetPassword')}>
            <Key className="h-4 w-4" /> إعادة تعيين كلمة المرور
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">تواصل</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setOpenDialog('sendNotification')} disabled={!isActionEnabled('sendNotification')}>
            <Bell className="h-4 w-4" /> إرسال إشعار
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-destructive">متقدم</DropdownMenuLabel>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setOpenDialog('delete')}
            disabled={!isActionEnabled('delete')}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> حذف المستخدم
          </DropdownMenuItem>
          {isOwner && (
            <DropdownMenuItem onClick={() => setOpenDialog('transferOwnership')} disabled={!isActionEnabled('transferOwnership')} variant="destructive">
              <Crown className="h-4 w-4" /> نقل الملكية
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ===== Dialogs (كلها بالعربية وبدون اختصار) ===== */}

      {/* تغيير الدور */}
      <Dialog open={openDialog === 'changeRole'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير دور المستخدم</DialogTitle>
            <DialogDescription>
              المستخدم: <span className="font-bold">{user.username}</span> — الدور الحالي: {getRoleLabel(user.role)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label>الدور الجديد *</Label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r} disabled={ROLE_ORDER.indexOf(r as UserRole) >= currentRoleIndex && currentUser.role !== 'owner'}>
                  {getRoleLabel(r)} {ROLE_ORDER.indexOf(r as UserRole) >= currentRoleIndex && currentUser.role !== 'owner' ? '(غير مسموح)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">فقط `owner` يمكنه ترقية إلى `owner`. لا يمكنك ترقية مستخدم إلى دور مساوٍ أو أعلى من دورك.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleChangeRole} disabled={loading || newRole === user.role}>
              {loading ? 'جاري...' : 'تأكيد تغيير الدور'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ترقية */}
      <Dialog open={openDialog === 'promote'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الترقية</DialogTitle>
            <DialogDescription>
              هل تريد ترقية <span className="font-bold">{user.username}</span> من <span className="font-bold">{getRoleLabel(user.role)}</span> إلى{' '}
              <span className="font-bold text-green-500">{getNextRole() ? getRoleLabel(getNextRole()!) : '—'}</span>؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={() => getNextRole() && handlePromoteDemote(getNextRole()!)} disabled={loading || !getNextRole()}>
              تأكيد الترقية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تنزيل */}
      <Dialog open={openDialog === 'demote'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد التنزيل</DialogTitle>
            <DialogDescription>
              هل تريد تنزيل <span className="font-bold">{user.username}</span> من <span className="font-bold">{getRoleLabel(user.role)}</span> إلى{' '}
              <span className="font-bold text-orange-500">{getPrevRole() ? getRoleLabel(getPrevRole()!) : '—'}</span>؟ سيُحرم من صلاحياته الحالية.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={() => getPrevRole() && handlePromoteDemote(getPrevRole()!)} disabled={loading || !getPrevRole()}>
              تأكيد التنزيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حظر */}
      <Dialog open={openDialog === 'ban'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حظر المستخدم — {user.username}</DialogTitle>
            <DialogDescription>اختر نوع الحظر واكتب السبب. سيُحرم المستخدم من تسجيل الدخول.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={banType === 'perm'} onChange={() => setBanType('perm')} /> حظر دائم
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={banType === 'temp'} onChange={() => setBanType('temp')} /> حظر مؤقت
              </label>
            </div>
            {banType === 'temp' && (
              <div>
                <Label>المدة بالأيام *</Label>
                <select value={banDays} onChange={(e) => setBanDays(Number(e.target.value))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value={1}>يوم واحد</option>
                  <option value={7}>7 أيام</option>
                  <option value={30}>30 يوم</option>
                  <option value={90}>90 يوم</option>
                  <option value={365}>سنة</option>
                </select>
              </div>
            )}
            <div>
              <Label>سبب الحظر *</Label>
              <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="اكتب سبب الحظر بوضوح..." rows={3} className="mt-1" />
            </div>
            {isAdminPlus && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={banIp} onChange={(e) => setBanIp(e.target.checked)} /> حظر عنوان IP أيضاً
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleBan} disabled={loading}>
              {loading ? 'جاري الحظر...' : 'تأكيد الحظر'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إلغاء الحظر */}
      <Dialog open={openDialog === 'unban'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إلغاء حظر {user.username}</DialogTitle>
            <DialogDescription>هل تريد إلغاء حظر هذا المستخدم؟ سيتمكن من تسجيل الدخول مجدداً وسيُرفع حظر IP المرتبط.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleUnban} disabled={loading}>
              {loading ? 'جاري...' : 'تأكيد إلغاء الحظر'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تحذير */}
      <Dialog open={openDialog === 'warn'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إرسال تحذير إلى {user.username}</DialogTitle>
            <DialogDescription>سيتم إشعار المستخدم بهذا التحذير وسيُسجل في سجل النشاطات.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>سبب التحذير *</Label>
            <Textarea value={warnReason} onChange={(e) => setWarnReason(e.target.value)} placeholder="اكتب نص التحذير..." rows={4} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleWarn} disabled={loading || !warnReason.trim()}>
              إرسال التحذير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إعادة تعيين كلمة المرور */}
      <Dialog open={openDialog === 'resetPassword'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور — {user.username}</DialogTitle>
            <DialogDescription>أنشئ كلمة مرور جديدة وسيتم إجبار المستخدم على تغييرها عند الدخول التالي.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)" className="flex-1" type="text" dir="ltr" />
              <Button variant="outline" onClick={generatePassword}>
                توليد عشوائي
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={forceLogout} onChange={(e) => setForceLogout(e.target.checked)} /> تسجيل خروج المستخدم من كل الجلسات
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleResetPassword} disabled={loading}>
              {loading ? 'جاري...' : 'تأكيد التغيير'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حذف */}
      <Dialog open={openDialog === 'delete'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">حذف المستخدم — إجراء لا يمكن التراجع عنه</DialogTitle>
            <DialogDescription>سيتم حذف المستخدم وكل بياناته المرتبطة. اكتب اسم المستخدم <span className="font-bold text-foreground">{user.username}</span> للتأكيد.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>اكتب اسم المستخدم للحذف *</Label>
            <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={user.username} className="mt-1" dir="ltr" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading || deleteConfirm !== user.username}>
              تأكيد الحذف النهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* عرض النشاط */}
      <Dialog open={openDialog === 'viewActivity'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>نشاط المستخدم — {user.username}</DialogTitle>
            <DialogDescription>آخر التعريبات والتعليقات والبلاغات وسجل الدخول وعناوين IP.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">التعريبات</div>
                <div className="text-lg font-bold">{user._count?.mods ?? 0}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">التعليقات</div>
                <div className="text-lg font-bold">{user._count?.comments ?? 0}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">تاريخ الانضمام</div>
                <div className="text-sm">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '—'}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">آخر دخول</div>
                <div className="text-sm">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ar-EG') : 'لم يدخل بعد'}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">التفاصيل الكاملة في صفحة `/admin/users/{user.id}`</p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/admin/users/${user.id}`}>فتح صفحة التفاصيل الكاملة</Link>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إرسال إشعار */}
      <Dialog open={openDialog === 'sendNotification'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إرسال إشعار إلى {user.username}</DialogTitle>
            <DialogDescription>سيصل الإشعار داخل الموقع وعبر البريد إن كان مفعلاً للمستخدم.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عنوان الإشعار *</Label>
              <Input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="مثال: تنبيه هام بخصوص حسابك" className="mt-1" />
            </div>
            <div>
              <Label>نص الإشعار *</Label>
              <Textarea value={notifBody} onChange={(e) => setNotifBody(e.target.value)} placeholder="اكتب نص الإشعار..." rows={4} className="mt-1" />
            </div>
            <div>
              <Label>الأولوية</Label>
              <select value={notifPriority} onChange={(e) => setNotifPriority(e.target.value as never)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="low">منخفضة</option>
                <option value="normal">عادية</option>
                <option value="high">عالية</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSendNotification} disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'إرسال الإشعار'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* سجل المستوى */}
      <Dialog open={openDialog === 'viewTierHistory'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl" className="max-w-xl">
          <DialogHeader>
            <DialogTitle>سجل المستوى — {user.username}</DialogTitle>
            <DialogDescription>كل ترقيات وتنزيلات المستوى مع السبب والتاريخ.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto text-sm">
            <p className="text-muted-foreground">يتم جلب السجل من `GET /api/admin/users/{user.id}/tier-history`</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href={`/admin/users/${user.id}?tab=tier`}>فتح سجل المستوى الكامل</Link>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نقل الملكية */}
      <Dialog open={openDialog === 'transferOwnership'} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-amber-500">نقل ملكية الموقع — تحذير خطر</DialogTitle>
            <DialogDescription>هذا سينقل ملكية الموقع منك إلى {user.username}. ستصبح أنت `manager` وسيصبح هو `owner`. هذا الإجراء خطير.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-bold text-destructive">اكتب "تأكيد النقل" للتأكيد:</p>
            <Input value={transferConfirm} onChange={(e) => setTransferConfirm(e.target.value)} placeholder='اكتب "تأكيد النقل"' className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={transferConfirm !== 'تأكيد النقل' || loading}
              onClick={async () => {
                setLoading(true)
                try {
                  const res = await fetch(`/api/admin/users/${user.id}/transfer-ownership`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ confirm: transferConfirm }),
                  })
                  if (!res.ok) throw new Error('فشل النقل')
                  toast({ title: 'تم نقل الملكية بنجاح' })
                  setOpenDialog(null)
                  onActionComplete()
                } catch (e) {
                  toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
                } finally {
                  setLoading(false)
                }
              }}
            >
              تأكيد نقل الملكية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
