'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2, Crown, Shield, Star, User as UserIcon, Ban, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { timeAgo, formatNumber } from '@/lib/format'
import { TierBadge } from '@/components/tier-badge'
import { SpecialRoleBadge } from '@/components/special-role-badge'
import { TierHistoryTable } from '@/components/tier-history-table'

interface UserData {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  bio: string | null
  role: string
  tier: number
  specialRoles: string | null
  bannedUntil: string | null
  banStatus: string | null
  banReason: string | null
  bannedBy: string | null
  bannedAt: string | null
  lastLoginAt: string | null
  loginCount: number
  emailVerified: boolean
  joinedAt: string
  createdAt: string
  _count: { mods: number; comments: number; endorsements: number }
}

interface UserAction {
  id: string
  action: string
  reason: string | null
  byUsername: string | null
  expiresAt: string | null
  ipAddress: string | null
  createdAt: string
}

interface UserComment {
  id: string
  text: string
  createdAt: string
  mod: { name: string; slug: string }
}

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  owner:     { label: 'مالك', icon: <Crown className="h-3 w-3" />, className: 'bg-amber-500 text-white' },
  admin:     { label: 'مدير',  icon: <Shield className="h-3 w-3" />, className: 'bg-red-500 text-white' },
  moderator: { label: 'مشرف',  icon: <Star className="h-3 w-3" />,  className: 'bg-purple-500 text-white' },
  member:    { label: 'عضو',   icon: <UserIcon className="h-3 w-3" />, className: 'bg-blue-500 text-white' },
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  ban: { label: 'حظر', color: 'text-red-400' },
  unban: { label: 'إلغاء حظر', color: 'text-green-400' },
  warn: { label: 'تحذير', color: 'text-yellow-400' },
  promote: { label: 'ترقية', color: 'text-blue-400' },
  demote: { label: 'تنزيل', color: 'text-orange-400' },
  login: { label: 'دخول', color: 'text-muted-foreground' },
  logout: { label: 'خروج', color: 'text-muted-foreground' },
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [user, setUser] = useState<UserData | null>(null)
  const [actions, setActions] = useState<UserAction[]>([])
  const [comments, setComments] = useState<UserComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'activity' | 'comments' | 'tier'>('overview')
  const [tierHistory, setTierHistory] = useState([])
  const [specialRoles, setSpecialRoles] = useState<any[]>([])

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => { setUser(data.user); setActions(data.actions || []); setComments(data.comments || []) })
      .catch(() => setError('فشل تحميل بيانات المستخدم'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (user) {
      fetch(`/api/admin/users/${user.id}/tier-history`)
        .then(r => r.json())
        .then(data => setTierHistory(data.history || []))

      fetch('/api/admin/special-roles')
        .then(r => r.json())
        .then(data => {
          const userRoleKeys = (user.specialRoles || '').split(',').filter(Boolean)
          setSpecialRoles(data.roles.filter((r: any) => userRoleKeys.includes(r.key)))
        })
    }
  }, [user])

  const onBan = async () => {
    const reason = prompt('سبب الحظر (اختياري):')
    try {
      const res = await fetch(`/api/admin/users/${id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'perm', reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'فشل الحظر')
      toast({ title: 'تم الحظر' })
      setUser((u) => u ? {
        ...u,
        bannedUntil: data.bannedUntil,
        banStatus: data.banStatus,
        banReason: data.banReason,
        bannedAt: new Date().toISOString(),
      } : u)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  const onUnban = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearIp: true }),
      })
      if (!res.ok) throw new Error('فشل إلغاء الحظر')
      toast({ title: 'تم إلغاء الحظر' })
      setUser((u) => u ? {
        ...u,
        bannedUntil: null,
        banStatus: 'active',
        banReason: null,
        bannedAt: null,
      } : u)
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    }
  }

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error || !user) return <div className="grid place-items-center py-20 text-center"><p className="text-sm text-destructive">{error || 'المستخدم غير موجود'}</p></div>

  const role = ROLE_BADGE[user.role] || ROLE_BADGE.member
  const isPermBanned = user.banStatus === 'banned_perm'
  const isTempBanned = user.banStatus === 'banned_temp'
    && user.bannedUntil
    && new Date(user.bannedUntil) > new Date()
  const isBanned = isPermBanned || isTempBanned

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/users" className="hover:text-foreground">المستخدمون</Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{user.username}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-bold">{user.username.charAt(0)}</div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{user.username}</h1>
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${role.className}`}>
              {role.icon} {role.label}
            </span>
            {isPermBanned && (
              <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                <Ban className="h-3 w-3" /> حظر دائم
              </span>
            )}
            {isTempBanned && (
              <span className="inline-flex items-center gap-1 rounded bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">
                <Ban className="h-3 w-3" /> محظور مؤقت
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          {user.bio && <p className="mt-1 text-sm">{user.bio}</p>}
        </div>
        <div className="flex gap-2">
          {isBanned ? (
            <Button variant="outline" size="sm" onClick={onUnban}>إلغاء الحظر</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onBan}>حظر</Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold">{formatNumber(user._count.mods)}</div>
          <div className="text-xs text-muted-foreground">تعريب</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold">{formatNumber(user._count.comments)}</div>
          <div className="text-xs text-muted-foreground">تعليق</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold">{formatNumber(user._count.endorsements)}</div>
          <div className="text-xs text-muted-foreground">تأييد</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-lg font-bold">{user.loginCount}</div>
          <div className="text-xs text-muted-foreground">دخول</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['overview', 'activity', 'comments', 'tier'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'overview' ? 'البيانات' : t === 'activity' ? 'النشاط' : t === 'comments' ? 'التعليقات' : 'المستوى والأدوار'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><span className="text-xs text-muted-foreground">تاريخ الانضمام</span><div className="text-sm">{new Date(user.joinedAt).toLocaleDateString('ar')}</div></div>
            <div><span className="text-xs text-muted-foreground">آخر دخول</span><div className="text-sm">{user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'لم يدخل بعد'}</div></div>
            <div><span className="text-xs text-muted-foreground">عدد الدخولات</span><div className="text-sm">{user.loginCount}</div></div>
            <div><span className="text-xs text-muted-foreground">البريد موثّق</span><div className="text-sm">{user.emailVerified ? 'نعم' : 'لا'}</div></div>
            <div><span className="text-xs text-muted-foreground">تاريخ الإنشاء</span><div className="text-sm">{new Date(user.createdAt).toLocaleDateString('ar')}</div></div>
          </div>

          {isBanned && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-red-400">
                <Ban className="h-4 w-4" />
                {isPermBanned ? 'محظور بشكل دائم' : 'محظور مؤقتاً'}
              </div>
              {user.banReason && (
                <div className="text-sm"><span className="text-muted-foreground">السبب: </span>{user.banReason}</div>
              )}
              {isTempBanned && user.bannedUntil && (
                <div className="text-sm"><span className="text-muted-foreground">ينتهي في: </span>{new Date(user.bannedUntil).toLocaleDateString('ar')}</div>
              )}
              {user.bannedAt && (
                <div className="text-sm"><span className="text-muted-foreground">تاريخ الحظر: </span>{timeAgo(user.bannedAt)}</div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="rounded-xl border border-border bg-card p-6">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد نشاط</p>
          ) : (
            <div className="space-y-3">
              {actions.map((a) => {
                const info = ACTION_LABELS[a.action] || { label: a.action, color: 'text-muted-foreground' }
                return (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <span className={`font-medium ${info.color}`}>{info.label}</span>
                      {a.byUsername && <span className="text-muted-foreground"> بواسطة {a.byUsername}</span>}
                      {a.reason && <span className="text-muted-foreground"> — {a.reason}</span>}
                      <div className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}{a.ipAddress ? ` · ${a.ipAddress}` : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'comments' && (
        <div className="rounded-xl border border-border bg-card p-6">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد تعليقات</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <Link key={c.id} href={`/?view=mod&slug=${c.mod.slug}`} target="_blank" className="block rounded-md p-2 transition-colors hover:bg-accent/50">
                  <p className="line-clamp-2 text-sm">{c.text}</p>
                  <div className="mt-1 text-xs text-muted-foreground">على {c.mod.name} · {timeAgo(c.createdAt)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'tier' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">المستوى الحالي</h3>
              <TierBadge tier={user.tier} size="md" />
            </div>

            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">الأدوار الخاصة</h3>
              <div className="flex gap-2">
                {specialRoles.length === 0 ? (
                  <span className="text-sm text-muted-foreground">لا توجد أدوار خاصة</span>
                ) : (
                  specialRoles.map((role: any) => (
                    <SpecialRoleBadge key={role.key} roleKey={role.key} roleName={role.name} icon={role.icon} color={role.color} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">سجل الترقيات</h3>
            <TierHistoryTable history={tierHistory} />
          </div>
        </div>
      )}
    </div>
  )
}
