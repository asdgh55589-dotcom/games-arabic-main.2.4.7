'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, ArrowRight, Flag, Package, MessageSquare, User,
  AlertTriangle, Clock, Shield, CheckCircle, XCircle, Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ReportStatusBadge } from '@/components/report-status-badge'
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
  evidenceUrls: string | null
  actionTaken: string | null
  actionAt: string | null
  resolution: string | null
  resolvedAt: string | null
  ipAddress: string | null
  createdAt: string
  previousReports: number
  reporter: { id: string; username: string; avatarUrl: string | null; role: string } | null
  targetMod: { id: string; name: string; slug: string; thumbnailUrl: string } | null
  targetComment: { id: string; text: string; createdAt: string } | null
  targetUser: { id: string; username: string; avatarUrl: string | null; role: string } | null
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

  const reportId = params.id as string

  const fetchReport = () => {
    setLoading(true)
    fetch(`/api/admin/reports/${reportId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => setReport(data.report))
      .catch(() => setError('فشل تحميل تفاصيل البلاغ'))
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
        toast({ title: data.error || 'فشل تأكيد البلاغ', variant: 'destructive' })
        return
      }
      toast({ title: 'تم تأكيد البلاغ واتخاذ الإجراء' })
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
  const evidenceUrls = report.evidenceUrls ? report.evidenceUrls.split(',') : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/reports')}>
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

          {evidenceUrls.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">الأدلة المرفقة</h3>
              <div className="flex flex-wrap gap-2">
                {evidenceUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`دليل ${i + 1}`} className="h-20 w-20 rounded object-cover border" />
                  </a>
                ))}
              </div>
            </Card>
          )}

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
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">المُبلِّغ</h3>
            <div className="flex items-center gap-2 text-sm">
              <span>{report.reporter?.username || 'مجهول'}</span>
              {report.reporter?.role && report.reporter.role !== 'member' && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{report.reporter.role}</span>
              )}
            </div>
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
                  onClick={() => handleConfirm('warned')}
                >
                  <AlertTriangle className="h-4 w-4" />
                  تحذير
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-orange-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirm('content_hidden')}
                >
                  <Ban className="h-4 w-4" />
                  إخفاء المحتوى
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-red-600"
                  disabled={actionLoading}
                  onClick={() => handleConfirm('content_deleted')}
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
                    onClick={() => handleConfirm('temp_ban')}
                  >
                    <Ban className="h-4 w-4" />
                    تعليق مؤقت
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  disabled={actionLoading}
                  onClick={() => handleConfirm('perm_ban')}
                >
                  <Ban className="h-4 w-4" />
                  حظر دائم
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-green-600"
                  disabled={actionLoading}
                  onClick={handleReject}
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
    </div>
  )
}