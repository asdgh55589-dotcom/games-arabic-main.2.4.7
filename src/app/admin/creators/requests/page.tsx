'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Check, X, ExternalLink, Clock, CheckCircle, XCircle, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'

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
  createdAt: string
  updatedAt: string
  user: { id: string; username: string; avatarUrl: string | null; email: string; joinedAt: string; role: string }
}

const STATUS_LABEL: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: 'قيد المراجعة', className: 'bg-amber-500 text-white', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'مقبول', className: 'bg-green-500 text-white', icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { label: 'مرفوض', className: 'bg-red-500 text-white', icon: <XCircle className="h-3 w-3" /> },
}

export default function AdminCreatorRequestsPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<CreatorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [rejectReason, setRejectReason] = useState('')

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/admin/creator-requests?${params.toString()}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setRequests(json.data?.requests || json.data || [])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [filter])

  const handleApprove = async (id: string) => {
    if (!confirm('هل أنت متأكد من قبول هذا الطلب؟ سيتم ترقية المستخدم إلى مُعَرِّب.')) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/creator-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'تم قبول الطلب وإشعار المستخدم' })
        fetchRequests()
      } else {
        toast({ title: json?.error?.message || json?.error?.details || 'فشل القبول', variant: 'destructive' })
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
        toast({ title: json?.error?.message || json?.error?.details || 'فشل الرفض', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }

  // For filter counts we need total counts not filtered; fetch already filtered, so we need to compute from unfiltered? Simple: show counts of current filtered list; also we have API that can return filtered, but for badge we show filtered counts — acceptable.
  // To get accurate counts we could fetch all, but spec says pending first; simple.

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">طلبات الترقية</h1>
        <p className="text-sm text-muted-foreground mt-1">مراجعة طلبات الأعضاء الراغبين في الانضمام لفريق المُعَرِّبين</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'pending', label: 'قيد المراجعة' },
          { key: 'approved', label: 'مقبولة' },
          { key: 'rejected', label: 'مرفوضة' },
        ].map((f) => (
          <Button key={f.key} variant={filter === f.key ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon="inbox" title="لا توجد طلبات" description={filter === 'pending' ? 'لا توجد طلبات قيد المراجعة حالياً' : 'لا توجد طلبات في هذا التصنيف'} />
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => {
            const statusInfo = STATUS_LABEL[req.status] || STATUS_LABEL.pending
            const isPending = req.status === 'pending'
            return (
              <Card key={req.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={req.user.avatarUrl || undefined} />
                        <AvatarFallback>{req.user.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link href={`/profile/${encodeURIComponent(req.user.username)}`} className="font-bold hover:underline">
                            {req.user.username}
                          </Link>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${statusInfo.className}`}>
                            {statusInfo.icon} {statusInfo.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {req.user.email} • انضم {new Date(req.user.joinedAt).toLocaleDateString('ar-EG')} • الطلب {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <RoleBadge role={(req.user as unknown as { role?: string })?.role} size="sm" />
                          <TierBadge tier={(req.user as unknown as { tier?: number })?.tier || 0} role={(req.user as unknown as { role?: string })?.role} size="sm" />
                          {(req.user as unknown as { specialRoles?: string })?.specialRoles && (
                            <span className="text-xs text-muted-foreground">• { (req.user as unknown as { specialRoles: string }).specialRoles }</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`/profile/${encodeURIComponent(req.user.username)}`} target="_blank">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3.5 w-3.5 ml-1" /> عرض البروفايل
                      </Button>
                    </Link>
                  </div>

                  <div className="grid gap-4 text-sm">
                    <div>
                      <div className="font-semibold text-muted-foreground text-xs mb-1">الخبرة في الترجمة</div>
                      <p className="whitespace-pre-wrap bg-muted/50 rounded p-3 text-sm">{req.experience || '—'}</p>
                    </div>
                    {req.preferredGames && (
                      <div>
                        <div className="font-semibold text-muted-foreground text-xs mb-1">الألعاب المفضلة</div>
                        <p className="text-sm">{req.preferredGames}</p>
                      </div>
                    )}
                    {req.portfolioLinks && (
                      <div>
                        <div className="font-semibold text-muted-foreground text-xs mb-1">روابط أعمال سابقة</div>
                        <p className="whitespace-pre-wrap text-sm break-all bg-muted/30 rounded p-2">{req.portfolioLinks}</p>
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-muted-foreground text-xs mb-1">سبب الرغبة</div>
                      <p className="whitespace-pre-wrap bg-muted/50 rounded p-3 text-sm">{req.reason || '—'}</p>
                    </div>
                    {req.status === 'rejected' && req.rejectReason && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                        <div className="font-semibold text-destructive text-xs mb-1">سبب الرفض</div>
                        <p className="text-sm">{req.rejectReason}</p>
                      </div>
                    )}
                  </div>

                  {isPending && (
                    <div className="flex gap-2 mt-6">
                      <Button onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id} className="bg-green-600 hover:bg-green-700">
                        {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Check className="h-4 w-4 ml-1" />}
                        قبول
                      </Button>
                      <Button variant="destructive" onClick={() => { setRejectDialog({ open: true, id: req.id }); setRejectReason('') }} disabled={actionLoading === req.id}>
                        <X className="h-4 w-4 ml-1" /> رفض
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, id: open ? rejectDialog.id : null })}>
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
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>إلغاء</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || !!actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null} تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
