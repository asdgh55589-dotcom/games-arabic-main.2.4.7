'use client'

import {
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  MessageCircle,
  Save,
  Search,
  StickyNote,
  Twitter,
  User,
  X,
  XCircle,
  Youtube,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface CreatorRequest {
  id: string
  userId: string
  experience: string | null
  preferredGames: string | null
  portfolioLinks: string | null
  reason: string | null
  status: string
  reviewedBy: string | null
  reviewedAt: string | null
  rejectReason: string | null
  track: string | null
  portfolioUrls: string | null
  experienceYears: number | null
  samplesCount: number | null
  agreeToTerms: boolean
  adminNotes: string | null
  twitterUrl: string | null
  youtubeUrl: string | null
  websiteUrl: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    username: string
    avatarUrl: string | null
    email: string
    joinedAt: string
    role: string
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_LABEL: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: 'قيد المراجعة',
    className: 'bg-amber-500 text-white',
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: 'مقبول',
    className: 'bg-green-500 text-white',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  rejected: {
    label: 'مرفوض',
    className: 'bg-red-500 text-white',
    icon: <XCircle className="h-3 w-3" />,
  },
}

const TRACK_LABEL: Record<string, { label: string; className: string }> = {
  publisher: { label: 'ناشر', className: 'bg-blue-500 text-white' },
  translator: { label: 'معرّب', className: 'bg-purple-500 text-white' },
}

const PAGE_SIZE = 20

export default function AdminCreatorRequestsPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<CreatorRequest[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [trackFilter, setTrackFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [bulkRejectReason, setBulkRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  })
  const [rejectReason, setRejectReason] = useState('')
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [notesSaving, setNotesSaving] = useState<string | null>(null)
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      if (trackFilter !== 'all') params.set('track', trackFilter)
      if (debouncedQuery) params.set('q', debouncedQuery)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const res = await fetch(`/api/admin/creator-requests?${params.toString()}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        setRequests(json.data?.requests || [])
        if (json.data?.pagination) setPagination(json.data.pagination)
        setSelected(new Set())
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [filter, trackFilter, debouncedQuery, page])

  const handleApprove = async (id: string, track: string | null) => {
    const roleName = track === 'publisher' ? 'ناشر' : 'معرّب'
    if (!confirm(`هل أنت متأكد من قبول هذا الطلب؟ سيتم ترقية المستخدم إلى ${roleName}.`))
      return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/creator-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approveNote: approveNotes[id]?.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'تم قبول الطلب وإشعار المستخدم' })
        fetchRequests()
      } else {
        toast({
          title: json?.error?.message || json?.error?.details || 'فشل القبول',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleReject = async () => {
    if (!rejectDialog.id || !rejectReason.trim()) {
      toast({ title: 'يجب كتابة سبب الرفض', variant: 'destructive' })
      return
    }
    setActionLoading(rejectDialog.id)
    try {
      const res = await fetch(`/api/admin/creator-requests/${rejectDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: rejectReason.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'تم رفض الطلب وإشعار المستخدم' })
        setRejectDialog({ open: false, id: null })
        setRejectReason('')
        fetchRequests()
      } else {
        toast({
          title: json?.error?.message || json?.error?.details || 'فشل الرفض',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleBulk = async (action: 'approve' | 'reject') => {
    const ids = [...selected]
    if (ids.length === 0) return
    if (action === 'approve' && !confirm(`قبول ${ids.length} طلباً؟`)) return
    if (action === 'reject' && !bulkRejectReason.trim()) {
      toast({ title: 'يجب كتابة سبب الرفض الجماعي', variant: 'destructive' })
      return
    }
    setBulkLoading(true)
    try {
      const res = await fetch('/api/admin/creator-requests/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ids,
          rejectReason: action === 'reject' ? bulkRejectReason.trim() : undefined,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({
          title: `تم: ${json.data?.succeeded || 0} نجاح، ${json.data?.failed || 0} فشل`,
        })
        setBulkRejectOpen(false)
        setBulkRejectReason('')
        fetchRequests()
      } else {
        toast({
          title: json?.error?.message || 'فشلت العملية الجماعية',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setBulkLoading(false)
  }

  const handleSaveNotes = async (id: string) => {
    setNotesSaving(id)
    try {
      const res = await fetch(`/api/admin/creator-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'note', adminNotes: notesDraft[id] || '' }),
      })
      if (res.ok) {
        toast({ title: 'تم حفظ الملاحظة الداخلية' })
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, adminNotes: (notesDraft[id] || '').trim() || null } : r,
          ),
        )
      } else {
        toast({ title: 'فشل حفظ الملاحظة', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setNotesSaving(null)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pendingOnPage = requests.filter((r) => r.status === 'pending')
  const allPendingSelected =
    pendingOnPage.length > 0 && pendingOnPage.every((r) => selected.has(r.id))

  const socialsOf = (req: CreatorRequest) =>
    [
      req.twitterUrl && {
        href: req.twitterUrl,
        label: 'تويتر / X',
        icon: <Twitter className="h-4 w-4" />,
      },
      req.youtubeUrl && {
        href: req.youtubeUrl,
        label: 'يوتيوب',
        icon: <Youtube className="h-4 w-4" />,
      },
      req.websiteUrl && {
        href: req.websiteUrl,
        label: 'الموقع الشخصي',
        icon: <Globe className="h-4 w-4" />,
      },
    ].filter(Boolean) as Array<{ href: string; label: string; icon: React.ReactNode }>

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">طلبات برنامج منشئ المحتوى</h1>
        <p className="text-sm text-muted-foreground mt-1">
          مراجعة طلبات الأعضاء الراغبين في الانضمام كمعرّبين أو ناشرين
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالاسم أو البريد..."
          className="ps-9"
        />
      </div>

      {/* Status + track filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'pending', label: 'قيد المراجعة' },
          { key: 'approved', label: 'مقبولة' },
          { key: 'rejected', label: 'مرفوضة' },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter(f.key)
              setPage(1)
            }}
          >
            {f.label}
          </Button>
        ))}
        <span className="text-muted-foreground text-sm mx-1">|</span>
        {[
          { key: 'all', label: 'كل المسارات' },
          { key: 'translator', label: 'معرّب' },
          { key: 'publisher', label: 'ناشر' },
        ].map((f) => (
          <Button
            key={f.key}
            variant={trackFilter === f.key ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setTrackFilter(f.key)
              setPage(1)
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-none border-[3px] border-primary/40 bg-primary/5 p-3">
          <span className="text-sm font-bold">تم تحديد {selected.size}</span>
          <Button size="sm" onClick={() => handleBulk('approve')} disabled={bulkLoading}>
            {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            قبول المحدد
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkRejectOpen(true)}
            disabled={bulkLoading}
          >
            <X className="h-4 w-4" /> رفض المحدد
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            إلغاء التحديد
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="لا توجد طلبات"
          description={
            filter === 'pending'
              ? 'لا توجد طلبات قيد المراجعة حالياً'
              : 'لا توجد طلبات في هذا التصنيف'
          }
        />
      ) : (
        <div className="grid gap-4">
          {pendingOnPage.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox
                checked={allPendingSelected}
                onCheckedChange={(v) => {
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (v === true) pendingOnPage.forEach((r) => next.add(r.id))
                    else pendingOnPage.forEach((r) => next.delete(r.id))
                    return next
                  })
                }}
              />
              تحديد كل المعلقة في الصفحة
            </label>
          )}
          {requests.map((req) => {
            const statusInfo = STATUS_LABEL[req.status] || STATUS_LABEL.pending
            const trackInfo = req.track ? TRACK_LABEL[req.track] : null
            const isPending = req.status === 'pending'
            const socials = socialsOf(req)
            return (
              <Card key={req.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      {isPending && (
                        <Checkbox
                          checked={selected.has(req.id)}
                          onCheckedChange={() => toggleSelect(req.id)}
                          aria-label={`تحديد طلب ${req.user.username}`}
                        />
                      )}
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={req.user.avatarUrl || undefined} />
                        <AvatarFallback>{req.user.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/profile/${encodeURIComponent(req.user.username)}`}
                            className="font-bold hover:underline"
                          >
                            {req.user.username}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${statusInfo.className}`}
                          >
                            {statusInfo.icon} {statusInfo.label}
                          </span>
                          {trackInfo && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${trackInfo.className}`}
                            >
                              {trackInfo.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {req.user.email} • انضم{' '}
                          {new Date(req.user.joinedAt).toLocaleDateString('ar-EG')} • الطلب{' '}
                          {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <RoleBadge
                            role={(req.user as unknown as { role?: string })?.role}
                            size="sm"
                          />
                          <TierBadge
                            tier={(req.user as unknown as { tier?: number })?.tier || 0}
                            role={(req.user as unknown as { role?: string })?.role}
                            size="sm"
                          />
                          {(req.user as unknown as { specialRoles?: string })?.specialRoles && (
                            <span className="text-xs text-muted-foreground">
                              • {(req.user as unknown as { specialRoles: string }).specialRoles}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/profile/${encodeURIComponent(req.user.username)}`}
                      target="_blank"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3.5 w-3.5 ml-1" /> عرض البروفايل
                      </Button>
                    </Link>
                  </div>

                  {/* Track facts */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {req.experienceYears !== null && req.experienceYears !== undefined && (
                      <Badge variant="outline">سنوات الخبرة: {req.experienceYears}</Badge>
                    )}
                    {req.samplesCount !== null && req.samplesCount !== undefined && (
                      <Badge variant="outline">عدد الأعمال: {req.samplesCount}</Badge>
                    )}
                    {socials.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.label}
                        aria-label={s.label}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {s.icon}
                        <span className="hidden sm:inline">{s.label}</span>
                      </a>
                    ))}
                  </div>

                  <div className="grid gap-4 text-sm">
                    <div>
                      <div className="font-semibold text-muted-foreground text-xs mb-1">
                        الخبرة في الترجمة
                      </div>
                      <p className="whitespace-pre-wrap bg-muted/50 rounded p-3 text-sm">
                        {req.experience || '—'}
                      </p>
                    </div>
                    {req.preferredGames && (
                      <div>
                        <div className="font-semibold text-muted-foreground text-xs mb-1">
                          الألعاب المفضلة
                        </div>
                        <p className="text-sm">{req.preferredGames}</p>
                      </div>
                    )}
                    {req.portfolioUrls && (
                      <div>
                        <div className="font-semibold text-muted-foreground text-xs mb-1">
                          ملف الأعمال
                        </div>
                        <ul className="space-y-1">
                          {req.portfolioUrls
                            .split(/[\n,]+/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((url) => (
                              <li key={url}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline break-all"
                                  dir="ltr"
                                >
                                  {url}
                                </a>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {req.portfolioLinks && (
                      <div>
                        <div className="font-semibold text-muted-foreground text-xs mb-1">
                          روابط أعمال سابقة
                        </div>
                        <p className="whitespace-pre-wrap text-sm break-all bg-muted/30 rounded p-2">
                          {req.portfolioLinks}
                        </p>
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-muted-foreground text-xs mb-1">
                        سبب الرغبة
                      </div>
                      <p className="whitespace-pre-wrap bg-muted/50 rounded p-3 text-sm">
                        {req.reason || '—'}
                      </p>
                    </div>
                    {/* Internal notes — never shown to applicant */}
                    <div className="border border-dashed rounded p-3 space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-muted-foreground text-xs">
                        <StickyNote className="h-3.5 w-3.5" /> ملاحظة داخلية (لا تظهر لمقدم الطلب)
                      </div>
                      {req.adminNotes && !(req.id in notesDraft) && (
                        <p className="text-sm whitespace-pre-wrap">{req.adminNotes}</p>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          value={notesDraft[req.id] ?? req.adminNotes ?? ''}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="ملاحظة للمراجعين فقط..."
                          rows={2}
                          className="resize-none text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveNotes(req.id)}
                          disabled={notesSaving === req.id}
                        >
                          {notesSaving === req.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {req.status === 'rejected' && req.rejectReason && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                        <div className="font-semibold text-destructive text-xs mb-1">سبب الرفض</div>
                        <p className="text-sm">{req.rejectReason}</p>
                      </div>
                    )}
                  </div>

                  {isPending && (
                    <div className="flex flex-col gap-2 mt-6">
                      <Input
                        value={approveNotes[req.id] || ''}
                        onChange={(e) =>
                          setApproveNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="ملاحظة للمقبول (اختياري — تظهر له)"
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove(req.id, req.track)}
                          disabled={actionLoading === req.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {actionLoading === req.id ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-1" />
                          ) : (
                            <Check className="h-4 w-4 ml-1" />
                          )}
                          قبول
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setRejectDialog({ open: true, id: req.id })
                            setRejectReason('')
                          }}
                          disabled={actionLoading === req.id}
                        >
                          <X className="h-4 w-4 ml-1" /> رفض
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="h-4 w-4" /> السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {pagination.page} من {pagination.totalPages} (الإجمالي {pagination.total})
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            التالي <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => setRejectDialog({ open, id: open ? rejectDialog.id : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض الطلب</DialogTitle>
            <DialogDescription>يجب كتابة سبب الرفض وسيتم إشعار المستخدم به</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">سبب الرفض *</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="اكتب سبب الرفض بوضوح..."
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || !!actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null} تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk reject dialog */}
      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض {selected.size} طلباً</DialogTitle>
            <DialogDescription>سيتم إشعار جميع المستخدمين بنفس السبب</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulkRejectReason">سبب الرفض *</Label>
            <Textarea
              id="bulkRejectReason"
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="اكتب سبب الرفض بوضوح..."
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleBulk('reject')}
              disabled={!bulkRejectReason.trim() || bulkLoading}
            >
              {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null} تأكيد الرفض
              الجماعي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
