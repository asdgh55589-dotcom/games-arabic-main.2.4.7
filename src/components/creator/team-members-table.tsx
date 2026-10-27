'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/official-ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/official-ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useTeamPermissions } from '@/hooks/use-team-permissions'
import { TeamGhostMemberModal } from '@/components/creator/team-ghost-member-modal'

export interface TeamMemberRow {
  id: string
  userId: string | null
  name: string
  username: string | null
  avatarUrl: string | null
  role: string
  status?: string
  isLinked: boolean
  joinedAt: string
  ghostName?: string | null
  ghostEmail?: string | null
  ghostAvatarUrl?: string | null
  ghostBio?: string | null
  bio?: string | null
}

interface TeamMembersTableProps {
  members?: TeamMemberRow[]
  loading?: boolean
  onChanged?: () => void
  userRole?: string | null
  teamRole?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'المالك',
  leader: 'القائد',
  admin: 'إداري',
  moderator: 'مشرف الفريق',
  translator: 'مترجم',
  member: 'عضو',
  tester: 'مختبر',
  guest: 'ضيف',
  reviewer: 'مراجع',
  editor: 'محرر',
}

const ASSIGNABLE_ROLES = ['admin', 'moderator', 'translator', 'member', 'tester'] as const
const ROLE_FILTER_OPTIONS = ['all', 'owner', 'admin', 'moderator', 'translator', 'member', 'tester'] as const
const STATUS_FILTER_OPTIONS = ['all', 'active', 'removed', 'left'] as const
const STATUS_LABELS: Record<string, string> = {
  all: 'الكل',
  active: 'نشط',
  removed: 'مزال',
  left: 'غادر',
}
const PAGE_SIZE = 20

interface PendingTransfer {
  id: string
  inviteeUsername: string | null
  expiresAt: string
}

export function TeamMembersTable({ onChanged, userRole, teamRole }: TeamMembersTableProps) {
  const { toast } = useToast()
  const perms = useTeamPermissions(userRole ?? teamRole)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [actionId, setActionId] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<TeamMemberRow | null>(null)
  const [pendingRemoveGhost, setPendingRemoveGhost] = useState<TeamMemberRow | null>(null)
  const [pendingNominate, setPendingNominate] = useState<TeamMemberRow | null>(null)
  const [transfer, setTransfer] = useState<PendingTransfer | null>(null)
  const [transferLink, setTransferLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [ghostModalOpen, setGhostModalOpen] = useState(false)
  const [ghostSaving, setGhostSaving] = useState(false)
  const [linkMember, setLinkMember] = useState<TeamMemberRow | null>(null)
  const [linkUsername, setLinkUsername] = useState('')
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)

  const [searchInput, setSearchInput] = useState(searchParams?.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams?.get('search') || '')
  const [roleFilter, setRoleFilter] = useState(searchParams?.get('role') || 'all')
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') || 'all')
  const [page, setPage] = useState(Number(searchParams?.get('page') || '1') || 1)
  const [version, setVersion] = useState(0)

  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const prevDebounced = useRef(debouncedSearch)

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset page when filters change
  useEffect(() => {
    if (prevDebounced.current !== debouncedSearch) {
      prevDebounced.current = debouncedSearch
      setPage(1)
    }
  }, [debouncedSearch])

  const fetchTransfer = useCallback(async () => {
    try {
      const res = await fetch('/api/creator/team/transfer', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) setTransfer(json.data?.pending ?? null)
    } catch {
      // transfer banner is advisory
    }
  }, [])

  useEffect(() => {
    fetchTransfer()
  }, [fetchTransfer, members.length])

  // Fetch members
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(PAGE_SIZE))
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
        if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter)
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
        const res = await fetch(`/api/creator/team/members?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok) {
          setMembers((json.data ?? []) as TeamMemberRow[])
          const pag = json.pagination
          setTotal(pag?.total ?? (json.data?.length ?? 0))
          setTotalPages(pag?.totalPages ?? 1)
        }
      } catch {
        // advisory
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, roleFilter, statusFilter, page, version])

  // URL state sync
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [debouncedSearch, roleFilter, statusFilter, page, pathname, router])

  const nominate = async () => {
    if (!pendingNominate) return
    const member = pendingNominate
    setPendingNominate(null)
    setActionId(member.id)
    setTransferLink(null)
    setCopied(false)
    try {
      const res = await fetch('/api/creator/team/transfer/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setTransferLink(json.data?.acceptUrl ?? null)
        toast({ title: 'تم إنشاء الترشيح — انسخ الرابط وأرسله للمرشح' })
        fetchTransfer()
        setVersion((v) => v + 1)
        onChanged?.()
      } else {
        toast({ title: json?.error?.message || 'فشل إنشاء الترشيح', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const revokeTransfer = async () => {
    setActionId('transfer')
    try {
      const res = await fetch('/api/creator/team/transfer/revoke', { method: 'POST' })
      if (res.ok) {
        toast({ title: 'تم إلغاء الترشيح' })
        setTransfer(null)
        setTransferLink(null)
      } else {
        const json = await res.json().catch(() => null)
        toast({ title: json?.error?.message || 'فشل الإلغاء', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const changeRole = async (member: TeamMemberRow, role: string) => {
    if (role === member.role) return
    setActionId(member.id)
    try {
      const res = await fetch('/api/creator/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, role }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم تحديث دور العضو' })
        setVersion((v) => v + 1)
        onChanged?.()
      } else {
        toast({
          title: json?.error?.message || 'فشل تحديث الدور',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const confirmRemove = async () => {
    if (!pendingRemove) return
    const member = pendingRemove
    setPendingRemove(null)
    setActionId(member.id)
    try {
      const res = await fetch(`/api/creator/team/members?memberId=${encodeURIComponent(member.id)}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تمت إزالة العضو' })
        setVersion((v) => v + 1)
        onChanged?.()
      } else {
        toast({
          title: json?.error?.message || 'فشل إزالة العضو',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const isGhostMember = (m: TeamMemberRow) => !m.isLinked || !m.username

  const saveGhost = async (data: { name: string; email?: string; role: string; avatarUrl?: string; bio?: string }) => {
    setGhostSaving(true)
    try {
      const res = await fetch('/api/creator/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, isGhost: true }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم إضافة العضو الضيف' })
        setGhostModalOpen(false)
        setVersion((v) => v + 1)
        onChanged?.()
      } else {
        toast({ title: json?.error?.message || 'فشل إضافة العضو الضيف', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setGhostSaving(false)
  }

  const confirmLinkAccount = async () => {
    if (!linkMember || !linkUsername.trim()) return
    setLinkSaving(true)
    try {
      const profileRes = await fetch(`/api/users/${encodeURIComponent(linkUsername.trim())}/full-profile`, { cache: 'no-store' })
      const profileJson = await profileRes.json().catch(() => null)
      const userId = profileJson?.data?.profile?.id
      if (!profileRes.ok || !userId) {
        toast({ title: 'المستخدم غير موجود', variant: 'destructive' })
        setLinkSaving(false)
        return
      }
      const res = await fetch(`/api/creator/team/members/${encodeURIComponent(linkMember.id)}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم ربط العضو بالحساب' })
        setLinkDialogOpen(false)
        setLinkMember(null)
        setLinkUsername('')
        setVersion((v) => v + 1)
        onChanged?.()
      } else {
        toast({ title: json?.error?.message || 'فشل الربط', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setLinkSaving(false)
  }

  const confirmRemoveGhost = async () => {
    if (!pendingRemoveGhost) return
    const member = pendingRemoveGhost
    setPendingRemoveGhost(null)
    setActionId(member.id)
    try {
      const res = await fetch(`/api/creator/team/members/${encodeURIComponent(member.id)}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم حذف العضو الضيف' })
        setVersion((v) => v + 1)
        onChanged?.()
      } else {
        toast({ title: json?.error?.message || 'فشل حذف العضو', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setRoleFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  const hasActiveFilters =
    searchInput.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all'

  if (loading && members.length === 0) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="جارٍ التحميل">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <>
      {transfer && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-3 p-3">
            <p className="min-w-0 flex-1 text-sm">
              ترشيح معلق لنقل الملكية إلى <span className="font-medium" dir="ltr">@{transfer.inviteeUsername}</span>
              {' '}— ينتهي {new Date(transfer.expiresAt).toLocaleDateString('ar')}
            </p>
            <Button variant="outline" size="sm" disabled={!perms.canTransfer || actionId === 'transfer'} aria-disabled={!perms.canTransfer} title={!perms.canTransfer ? 'ليس لديك صلاحية' : undefined} onClick={revokeTransfer}>
              إلغاء الترشيح
            </Button>
          </CardContent>
        </Card>
      )}
      {transferLink && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-3">
            <p className="text-sm font-medium">رابط الترشيح (يظهر مرة واحدة فقط):</p>
            <p className="break-all text-xs text-muted-foreground" dir="ltr">
              {transferLink}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(transferLink).then(() => setCopied(true)).catch(() => {
                  toast({ title: 'تعذر النسخ — انسخ الرابط يدوياً', variant: 'destructive' })
                })
              }}
            >
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="بحث عن عضو..."
          className="min-w-[180px] flex-1"
        />
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36" aria-label="فلتر الدور">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأدوار</SelectItem>
            {ROLE_FILTER_OPTIONS.filter((r) => r !== 'all').map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-32" aria-label="فلتر الحالة">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            مسح الفلاتر
          </Button>
        )}
        {perms.canInvite && (
          <Button size="sm" onClick={() => setGhostModalOpen(true)}>
            إضافة عضو ضيف
          </Button>
        )}
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {members.length} من {total}
        </span>
        {totalPages > 1 && (
          <span>
            صفحة {page} من {totalPages}
          </span>
        )}
      </div>

      {members.length === 0 && !loading ? (
        <EmptyState
          icon="users"
          title="لا توجد نتائج"
          description="جرّب تغيير معايير البحث أو الفلاتر"
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {members.map((m) => {
              const locked = m.role === 'owner'
              const busy = actionId === m.id
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-muted/40">
                  <Avatar className="h-10 w-10">
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                    <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-medium flex items-center gap-2">
                      {m.name}
                      {isGhostMember(m) && (
                        <Badge className="bg-amber-500/15 text-amber-700 border border-amber-500/30">ضيف</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {m.username ? `@${m.username}` : 'عضو وهمي'} ·{' '}
                      {new Date(m.joinedAt).toLocaleDateString('ar')}
                    </p>
                    {isGhostMember(m) && (m.ghostEmail || m.ghostBio) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {m.ghostEmail && <span dir="ltr">{m.ghostEmail}</span>}
                        {m.ghostEmail && m.ghostBio && ' · '}
                        {m.ghostBio && <span>{m.ghostBio}</span>}
                      </p>
                    )}
                  </div>
                  {locked ? (
                    <Badge variant="default">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                  ) : (
                    <Select
                      value={ASSIGNABLE_ROLES.includes(m.role as (typeof ASSIGNABLE_ROLES)[number]) ? m.role : 'member'}
                      onValueChange={(role) => changeRole(m, role)}
                      disabled={!perms.canChangeRole || busy || !m.isLinked}
                    >
                      <SelectTrigger className="w-32" aria-label={`دور ${m.name}`} aria-disabled={!perms.canChangeRole} title={!perms.canChangeRole ? 'ليس لديك صلاحية' : undefined}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isGhostMember(m) ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!perms.canInvite || busy}
                        aria-disabled={!perms.canInvite}
                        title={!perms.canInvite ? 'ليس لديك صلاحية' : undefined}
                        onClick={() => {
                          setLinkMember(m)
                          setLinkUsername('')
                          setLinkDialogOpen(true)
                        }}
                        aria-label={`ربط ${m.name} بحساب`}
                      >
                        ربط بحساب
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!perms.canRemove || locked || busy}
                        aria-disabled={!perms.canRemove}
                        title={!perms.canRemove ? 'ليس لديك صلاحية' : undefined}
                        onClick={() => setPendingRemoveGhost(m)}
                        aria-label={`حذف ${m.name}`}
                      >
                        {busy ? '...' : 'إزالة الضيف'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!perms.canRemove || locked || busy}
                        aria-disabled={!perms.canRemove}
                        title={!perms.canRemove ? 'ليس لديك صلاحية' : undefined}
                        onClick={() => setPendingRemove(m)}
                        aria-label={`إزالة ${m.name}`}
                      >
                        {busy ? '...' : 'إزالة'}
                      </Button>
                      {!locked && m.isLinked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!perms.canTransfer || busy || transfer !== null}
                          aria-disabled={!perms.canTransfer}
                          title={!perms.canTransfer ? 'ليس لديك صلاحية' : undefined}
                          onClick={() => setPendingNominate(m)}
                          aria-label={`نقل الملكية إلى ${m.name}`}
                        >
                          نقل الملكية
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            {members.length} من {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            التالي
          </Button>
        </div>
      )}

      <AlertDialog open={pendingNominate !== null} onOpenChange={(open) => !open && setPendingNominate(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>نقل ملكية الفريق؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم ترشيح {pendingNominate?.name} ليصبح مالك الفريق. بعد قبوله ستصبح إدارياً وستفقد صلاحيات المالك.
              الترشيح صالح لمدة 7 أيام ويمكنك إلغاؤه قبل القبول.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={nominate}>تأكيد الترشيح</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة العضو؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إزالة {pendingRemove?.name} من الفريق. سيبقى اسمه محفوظاً في سجل الفريق كعضو سابق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>تأكيد الإزالة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingRemoveGhost !== null} onOpenChange={(open) => !open && setPendingRemoveGhost(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العضو الضيف؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف {pendingRemoveGhost?.name} نهائياً من الفريق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveGhost}>تأكيد الحذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TeamGhostMemberModal open={ghostModalOpen} onOpenChange={setGhostModalOpen} onSave={saveGhost} saving={ghostSaving} />

      <Dialog open={linkDialogOpen} onOpenChange={(v) => { if (!v) { setLinkMember(null); setLinkUsername('') } setLinkDialogOpen(v) }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ربط {linkMember?.name} بحساب</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              value={linkUsername}
              onChange={(e) => setLinkUsername(e.target.value)}
              placeholder="اسم المستخدم"
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLinkDialogOpen(false); setLinkMember(null); setLinkUsername('') }} disabled={linkSaving}>
              إلغاء
            </Button>
            <Button onClick={confirmLinkAccount} disabled={linkSaving || !linkUsername.trim()}>
              {linkSaving ? 'جاري الربط...' : 'ربط'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
