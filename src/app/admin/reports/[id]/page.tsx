'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, ArrowRight, Flag, Package, MessageSquare, User, UserX, UserCog,
  AlertTriangle, Clock, Shield, CheckCircle, XCircle, Ban,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ReportStatusBadge } from '@/components/report-status-badge'
import { getRoleLabel } from '@/lib/roles'
import { ReportFraudCard } from '@/components/admin/report-fraud-card'
import { UserTrustBadge } from '@/components/admin/user-trust-badge'
import { ReportHistoryTimeline } from '@/components/admin/report-history-timeline'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'
import {
  REPORT_REASONS, REPORT_PRIORITIES, REPORT_STATUSES,
  REPORT_ACTIONS, REPORT_TARGET_TYPES,
} from '@/lib/reports/constants'
import type { ReportReason, ReportPriority, ReportAction } from '@/lib/reports/constants'

interface ReportDetail {
  id: string
  targetType: string
  reason: string
  priority: string
  status: string
  description: string | null
  evidenceUrls: string[] | string | null // Json array بعد التغيير، مع توافق قديم String
  actionTaken: string | null
  actionAt: string | null
  resolution: string | null
  resolvedAt: string | null
  ipAddress: string | null
  createdAt: string
  previousReports: number
  fraudScore?: number
  repeatOffenseLevel?: number
  fraudSignals?: Array<{ id: string; signalType: string; score: number; description: string; createdAt: string }>
  reporter: { id: string; username: string; avatarUrl: string | null; role: string; trustScore?: { score: number; totalReports: number; confirmedReports: number; rejectedReports: number; reportAccuracy?: number } | null } | null
  targetMod: { id: string; name: string; slug: string; thumbnailUrl: string } | null
  targetComment: { id: string; text: string; createdAt: string } | null
  targetUser: { id: string; username: string; avatarUrl: string | null; role: string; trustScore?: { score: number; totalReports: number; confirmedReports: number; rejectedReports: number } | null } | null
  assignedToId: string | null
  assignedTo: { id: string; username: string; avatarUrl: string | null } | null
}

export default function AdminReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [resolution, setResolution] = useState('')
  const [banDuration, setBanDuration] = useState(7)
  const [currentRole, setCurrentRole] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const role = j?.data?.user?.role || j?.user?.role || null
        if (role) setCurrentRole(role)
      })
      .catch(() => {})
  }, [])
  const canPermBan = currentRole ? ['manager', 'admin', 'owner'].includes(currentRole) : false

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    action: string
    title: string
    description: string
    isDestructive: boolean
  } | null>(null)

  const ACTION_METADATA: Record<string, { title: string; description: string; isDestructive: boolean }> = {
    warned: {
      title: 'تأكيد التحذير',
      description: 'هل أنت متأكد من إرسال تحذير رسمي لهذا المستخدم؟ سيتم إرسال إشعار له.',
      isDestructive: false,
    },
    content_hidden: {
      title: 'تأكيد إخفاء المحتوى',
      description: 'هل أنت متأكد من إخفاء هذا المحتوى؟ لن يظهر في القوائم العامة.',
      isDestructive: false,
    },
    content_deleted: {
      title: 'تأكيد الحذف النهائي',
      description: '⚠️ تحذير: سيتم حذف المحتوى نهائياً ولا يمكن استرجاعه! هل أنت متأكد؟',
      isDestructive: true,
    },
    temp_ban: {
      title: 'تأكيد التعليق المؤقت',
      description: `هل أنت متأكد من تعليق هذا المستخدم لمدة ${banDuration} يوم؟`,
      isDestructive: true,
    },
    perm_ban: {
      title: 'تأكيد الحظر الدائم',
      description: '⚠️ تحذير خطير: سيتم حظر هذا المستخدم نهائياً! هذا الإجراء لا يمكن التراجع عنه.',
      isDestructive: true,
    },
    rejected: {
      title: 'تأكيد رفض البلاغ',
      description: 'هل أنت متأكد من رفض هذا البلاغ؟ سيتم إشعار المبلغ بالرفض.',
      isDestructive: false,
    },
  }

  const handleConfirmAction = (actionKey: string) => {
    const meta = ACTION_METADATA[actionKey]
    if (!meta) {
      // fallback مباشر إذا لم يوجد وصف
      if (actionKey === 'rejected') handleReject()
      else handleConfirm(actionKey as ReportAction)
      return
    }
    // فحص صلاحية الحظر الدائم قبل عرض الحوار
    if (actionKey === 'perm_ban' && !canPermBan) {
      toast({ title: 'الحظر الدائم متاح للمديرين فقط', variant: 'destructive' })
      return
    }
    setConfirmDialog({
      open: true,
      action: actionKey,
      title: meta.title,
      description: meta.description,
      isDestructive: meta.isDestructive,
    })
  }

  const reportId = params.id as string

  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    if (!report?.id) return
    setHistoryLoading(true)
    fetch(`/api/admin/reports/${report.id}/history`)
      .then((r) => r.json())
      .then((data) => {
        const list = data?.data
        setHistory(Array.isArray(list) ? list : list?.history || [])
      })
      .catch((err) => {
        console.error('Failed to load history:', err)
      })
      .finally(() => setHistoryLoading(false))
  }, [report?.id])

  const [assignable, setAssignable] = useState<any[]>([])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    fetch('/api/admin/reports/assignable')
      .then((r) => r.json())
      .then((data) => setAssignable(data.data || []))
      .catch((err) => console.error('Failed to load assignable:', err))
  }, [])

  const handleAssign = async (userId: string) => {
    setAssigning(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: userId === 'none' ? null : userId }),
      })
      if (res.ok) {
        toast({ title: userId === 'none' ? 'تم إلغاء التعيين' : 'تم تعيين المشرف بنجاح' })
        fetchReport()
      } else {
        const data = await res.json()
        const msg = data?.error?.message || data?.error?.details?.assignedToId || 'فشل التعيين'
        toast({ title: msg, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'فشل التعيين', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  const fetchReport = () => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/reports/${reportId}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null)
        if (!r.ok) {
          const msg =
            data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            (r.status === 404 ? 'البلاغ غير موجود' : `خطأ في الخادم (${r.status})`)
          throw new Error(msg)
        }
        // API يرجع { data: { report: {...} } } عبر ok({ report })
        const reportData = data?.data?.report || data?.report || data?.data
        if (!reportData || !reportData.id) throw new Error('البلاغ غير موجود')
        return reportData
      })
      .then((reportData) => setReport(reportData))
      .catch((err) => setError(err instanceof Error ? err.message : 'فشل تحميل تفاصيل البلاغ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchReport() }, [reportId])

  const handleStatusUpdate = async (newStatus: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, resolution }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'تم تحديث حالة البلاغ' })
      fetchReport()
    } catch {
      toast({ title: 'فشل تحديث الحالة', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirm = async (action: ReportAction) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resolution, banDuration }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : data?.error?.message || 'فشل تأكيد البلاغ'
        toast({ title: msg, variant: 'destructive' })
        return
      }
      toast({ title: action === 'perm_ban' ? 'تم الحظر الدائم للمستخدم بنجاح' : 'تم تأكيد البلاغ واتخاذ الإجراء' })
      fetchReport()
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'تم رفض البلاغ' })
      fetchReport()
    } catch {
      toast({ title: 'فشل رفض البلاغ', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error || !report) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error || 'البلاغ غير موجود'}</p>
      </div>
    )
  }

  const targetLabel = REPORT_TARGET_TYPES[report.targetType as keyof typeof REPORT_TARGET_TYPES]?.label || report.targetType
  const reasonConfig = REPORT_REASONS[report.reason as ReportReason]
  const priorityConfig = REPORT_PRIORITIES[report.priority as ReportPriority]
  // Json array بعد التغيير + توافق مع بيانات قديمة comma-joined
  const evidenceUrls: string[] = (() => {
    const ev = report.evidenceUrls as unknown
    if (Array.isArray(ev)) return ev.filter((u): u is string => typeof u === 'string' && u.length > 0)
    if (typeof ev === 'string' && ev) return ev.split(',').map((s) => s.trim()).filter(Boolean)
    return []
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => router.push('/admin/reports')}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">تفاصيل البلاغ</h1>
          <p className="mt-1 text-sm text-muted-foreground">ID: {report.id}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="mb-4 font-semibold">معلومات البلاغ</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">النوع</span>
                <span className="flex items-center gap-1.5">
                  {targetLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">السبب</span>
                <span>{reasonConfig?.label || report.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الأولوية</span>
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${priorityConfig?.color || ''}`}>
                  {priorityConfig?.label || report.priority}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الحالة</span>
                <ReportStatusBadge status={report.status as any} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">التاريخ</span>
                <span>{timeAgo(report.createdAt)}</span>
              </div>
              {report.ipAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP</span>
                  <span className="font-mono text-xs">{report.ipAddress}</span>
                </div>
              )}
              {report.previousReports > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">بلاغات سابقة</span>
                  <span className="font-bold text-destructive">{report.previousReports}</span>
                </div>
              )}
            </div>
          </Card>

          {report.description && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">تفاصيل المُبلِّغ</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.description}</p>
            </Card>
          )}

          {evidenceUrls.length > 0 ? (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">الأدلة المرفقة</h3>
              <div className="grid grid-cols-3 gap-2">
                {evidenceUrls.map((url, i) => {
                  try {
                    const parsed = new URL(url)
                    if (!['http:', 'https:'].includes(parsed.protocol)) return null
                    return (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative block overflow-hidden rounded border"
                      >
                        <img
                          src={url}
                          alt={`دليل ${i + 1}`}
                          className="h-20 w-20 w-full object-cover"
                          onError={(e) => {
                            const t = e.currentTarget as HTMLImageElement & { _fallback?: boolean }
                            if (!t._fallback) {
                              t._fallback = true
                              t.src = '/placeholder-image.png'
                            }
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          <ExternalLink className="h-5 w-5 text-white" />
                        </div>
                      </a>
                    )
                  } catch {
                    return null
                  }
                })}
              </div>
            </Card>
          ) : null}

          {report.targetMod && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">التعريب المُبلَّغ عنه</h3>
              <Link href={`/mods/${report.targetMod.slug}`} className="text-primary hover:underline" target="_blank">
                {report.targetMod.name}
              </Link>
            </Card>
          )}
          {report.targetComment && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">التعليق المُبلَّغ عنه</h3>
              <p className="text-sm text-muted-foreground">{report.targetComment.text}</p>
            </Card>
          )}
          {report.targetUser && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">المستخدم المُبلَّغ عنه</h3>
              <Link href={`/profile/${report.targetUser.username}`} className="text-primary hover:underline" target="_blank">
                {report.targetUser.username}
              </Link>
            </Card>
          )}

          {historyLoading ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 animate-spin" />
                  سجل التغييرات
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <ReportHistoryTimeline history={history} />
          )}
        </div>

        <div className="space-y-4">
          <ReportFraudCard fraudScore={report.fraudScore || 0} signals={report.fraudSignals || []} />

          <Card className="p-5">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                المُبلِّغ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{report.reporter?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Link
                    href={report.reporter ? `/admin/users/${report.reporter.id}` : '#'}
                    className="font-medium hover:underline"
                  >
                    {report.reporter?.username || 'مجهول'}
                  </Link>
                  {report.reporter?.role && report.reporter.role !== 'member' && (
                    <Badge variant="outline" className="mr-2 text-xs">
                      {getRoleLabel(report.reporter.role)}
                    </Badge>
                  )}
                </div>
              </div>
              <UserTrustBadge score={report.reporter?.trustScore || null} label="ثقة المُبلِّغ" showDetails={true} />
            </CardContent>
          </Card>

          {report.targetUser && (
            <Card className="p-5">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserX className="h-5 w-5" />
                  المُبلَّغ عنه
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{report.targetUser.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Link href={`/admin/users/${report.targetUser.id}`} className="font-medium hover:underline">
                      {report.targetUser.username}
                    </Link>
                    {report.targetUser.role && report.targetUser.role !== 'member' && (
                      <Badge variant="outline" className="mr-2 text-xs">
                        {getRoleLabel(report.targetUser.role)}
                      </Badge>
                    )}
                  </div>
                </div>
                <UserTrustBadge score={report.targetUser?.trustScore || null} label="ثقة المُستهدف" showDetails={true} />
              </CardContent>
            </Card>
          )}

          <Card className="p-5">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCog className="h-5 w-5" />
                المسؤول المعين
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Select
                value={report.assignedToId || report.assignedTo?.id || 'none'}
                onValueChange={handleAssign}
                disabled={assigning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="غير مُعيَّن" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير مُعيَّن</SelectItem>
                  {assignable.map((m: { id: string; username: string; role: string; workload: number }) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.username} ({getRoleLabel(m.role)}) — {m.workload} بلاغ
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {report.assignedTo && (
                <p className="text-xs text-muted-foreground mt-2">
                  مُعيَّن حالياً: <span className="font-medium">{report.assignedTo.username}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold">ملاحظات الحل</h3>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="اكتب ملاحظات..."
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </Card>

          {report.status !== 'confirmed' && report.status !== 'resolved' && (
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">الإجراءات</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate('under_review')}
                >
                  <Clock className="h-4 w-4" />
                  قيد المراجعة
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-yellow-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirmAction('warned')}
                >
                  <AlertTriangle className="h-4 w-4" />
                  تحذير
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-orange-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirmAction('content_hidden')}
                >
                  <Ban className="h-4 w-4" />
                  إخفاء المحتوى
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-red-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirmAction('content_deleted')}
                >
                  <XCircle className="h-4 w-4" />
                  حذف المحتوى
                </Button>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={banDuration}
                    onChange={(e) => setBanDuration(Number(e.target.value))}
                    min={1}
                    max={365}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <Button
                    variant="outline"
                    className="flex-1 justify-start gap-2 text-red-600"
                    disabled={actionLoading}
                    onClick={() => handleConfirmAction('temp_ban')}
                  >
                    <Ban className="h-4 w-4" />
                    تعليق مؤقت
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  disabled={actionLoading || !canPermBan}
                  title={!canPermBan ? 'الحظر الدائم متاح للمديرين فقط' : undefined}
                  onClick={() => handleConfirmAction('perm_ban')}
                >
                  <Ban className="h-4 w-4" />
                  حظر دائم {!canPermBan && <span className="text-[10px] opacity-70">— للمديرين فقط</span>}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-green-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirmAction('rejected')}
                >
                  <CheckCircle className="h-4 w-4" />
                  رفض البلاغ
                </Button>
              </div>
            </Card>
          )}

          {report.actionTaken && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">الإجراء المتخذ</h3>
              <p className="text-sm">{REPORT_ACTIONS[report.actionTaken as ReportAction]?.label || report.actionTaken}</p>
              {report.actionAt && (
                <p className="mt-1 text-xs text-muted-foreground">{timeAgo(report.actionAt)}</p>
              )}
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={!!confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-6">
              {confirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel onClick={() => setConfirmDialog(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDialog) return
                const act = confirmDialog.action
                setConfirmDialog(null)
                if (act === 'rejected') handleReject()
                else handleConfirm(act as ReportAction)
              }}
              className={confirmDialog?.isDestructive ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600' : ''}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}