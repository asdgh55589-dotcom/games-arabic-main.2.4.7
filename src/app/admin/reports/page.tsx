// Updated for new API response format
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Flag, Filter, Package, MessageSquare, User, Eye, Download, Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ReportStatusBadge } from '@/components/report-status-badge'
import { ReportStatsCards } from '@/components/admin/report-stats-cards'
import { ReportTrendChart } from '@/components/admin/report-trend-chart'
import { timeAgo } from '@/lib/format'
import { REPORT_REASONS, REPORT_PRIORITIES, REPORT_TARGET_TYPES, REPORT_STATUSES } from '@/lib/reports/constants'
import type { ReportReason, ReportPriority, ReportTargetType } from '@/lib/reports/constants'

interface ReportEntry {
  id: string
  targetType: string
  reason: string
  priority: string
  status: string
  description: string | null
  createdAt: string
  reporter: { id: string; username: string; avatarUrl: string | null } | null
  targetMod: { id: string; name: string; slug: string } | null
  targetComment: { id: string; text: string } | null
  targetUser: { id: string; username: string; avatarUrl: string | null } | null
  assignedTo: { id: string; username: string; avatarUrl: string | null } | null
}

const TARGET_ICONS: Record<string, React.ReactNode> = {
  mod: <Package className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [targetTypeFilter, setTargetTypeFilter] = useState('')
  const [assignable, setAssignable] = useState<Array<{ id: string; username: string; role: string; workload: number }>>([])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (statusFilter) params.set('status', statusFilter)
    if (reasonFilter) params.set('reason', reasonFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    if (targetTypeFilter) params.set('targetType', targetTypeFilter)

    fetch(`/api/admin/reports?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        setReports(data.data.reports)
        setTotalPages(data.data.totalPages)
        setTotal(data.data.total)
      })
      .catch(() => setError('فشل تحميل البلاغات'))
      .finally(() => setLoading(false))
  }, [page, statusFilter, reasonFilter, priorityFilter, targetTypeFilter])

  useEffect(() => {
    fetch('/api/admin/reports/assignable')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data) setAssignable(data.data)
      })
      .catch(() => {})
  }, [])

  if (loading && reports.length === 0) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-lg border border-border bg-card p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,80,80,0.12),transparent_30%),radial-gradient(circle_at_left,rgba(255,180,70,0.08),transparent_25%)]" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/15 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-red-300/80">
              Trust & Safety
            </div>

            <h1 className="mt-5 text-4xl font-black text-white">
              مركز البلاغات والإشراف
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
              مراجعة البلاغات وإدارة المحتوى المخالف ومتابعة نشاط المجتمع من مركز إشراف موحد.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:min-w-[420px]">
            <div className="rounded-2xl border border-red-500/15 bg-red-500/10 p-5">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-red-300/80">
                Total Reports
              </div>

              <div className="mt-3 text-4xl font-black text-red-300">
                {total}
              </div>
            </div>

            <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/10 p-5">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-yellow-300/80">
                Moderation Queue
              </div>

              <div className="mt-3 text-4xl font-black text-yellow-300">
                {reports.filter((r) => r.status === 'pending').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {assignable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            عبء العمل:
          </div>
          {assignable.slice(0, 5).map((m) => (
            <Badge key={m.id} variant="outline" className="gap-1">
              {m.username}: {m.workload} بلاغ
            </Badge>
          ))}
        </div>
      )}

      <ReportStatsCards />

      <ReportTrendChart />

      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-md border border-border bg-background-secondary px-3 text-sm text-foreground"
          >
            <option value="">كل الحالات</option>
            {Object.entries(REPORT_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => { setReasonFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-border bg-background-secondary px-3 text-sm text-foreground"
        >
          <option value="">كل الأسباب</option>
          {Object.entries(REPORT_REASONS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-border bg-background-secondary px-3 text-sm text-foreground"
        >
          <option value="">كل الأولويات</option>
          {Object.entries(REPORT_PRIORITIES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-border bg-background-secondary px-3 text-sm text-foreground"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(REPORT_TARGET_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="min-h-[44px]" asChild>
          <a
            href={`/api/admin/reports/export${(() => {
              const p = new URLSearchParams()
              if (statusFilter) p.set('status', statusFilter)
              if (reasonFilter) p.set('reason', reasonFilter)
              if (priorityFilter) p.set('priority', priorityFilter)
              return p.toString() ? `?${p}` : ''
            })()}`}
            download
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </a>
        </Button>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="لا توجد بلاغات"
        />
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-right">
              <thead className="border-b border-border bg-background-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">النوع</th>
                  <th className="px-4 py-3 font-semibold">السبب</th>
                  <th className="px-4 py-3 font-semibold">الأولوية</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">المُبلِّغ</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">المسؤول</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">الوقت</th>
                  <th className="px-4 py-3 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {reports.map((report) => (
                  <tr key={report.id} className="text-sm transition-colors hover:bg-background-secondary">
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5">
                        {TARGET_ICONS[report.targetType]}
                        {REPORT_TARGET_TYPES[report.targetType as ReportTargetType]?.label || report.targetType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{REPORT_REASONS[report.reason as ReportReason]?.label || report.reason}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-black shadow-lg ${REPORT_PRIORITIES[report.priority as ReportPriority]?.color || ''}`}>
                        {REPORT_PRIORITIES[report.priority as ReportPriority]?.label || report.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ReportStatusBadge status={report.status as any} />
                    </td>
                     <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                       {report.reporter?.username || 'مجهول'}
                     </td>
                     <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                      {report.assignedTo?.username || (
                        <span className="text-muted-foreground">غير مُعيَّن</span>
                      )}
                    </td>
                     <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                       {timeAgo(report.createdAt)}
                     </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/reports/${report.id}`}>
                        <Button variant="ghost" size="sm" className="rounded-md border border-border bg-background-secondary text-muted-foreground hover:text-primary min-h-[44px]">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {reports.map((report) => (
              <Card key={report.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {TARGET_ICONS[report.targetType]}
                      <span>{REPORT_TARGET_TYPES[report.targetType as ReportTargetType]?.label || report.targetType}</span>
                      <span className="text-xs font-normal text-muted-foreground">• {REPORT_REASONS[report.reason as ReportReason]?.label || report.reason}</span>
                    </div>
                    <ReportStatusBadge status={report.status as any} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-black shadow-lg ${REPORT_PRIORITIES[report.priority as ReportPriority]?.color || ''}`}>
                      {REPORT_PRIORITIES[report.priority as ReportPriority]?.label || report.priority}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {REPORT_REASONS[report.reason as ReportReason]?.label || report.reason}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(report.createdAt)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-background-secondary p-2.5">
                      <div className="font-semibold text-muted-foreground">المُبلِّغ</div>
                      <div className="mt-1 font-medium">{report.reporter?.username || 'مجهول'}</div>
                    </div>
                    <div className="rounded-md bg-background-secondary p-2.5">
                      <div className="font-semibold text-muted-foreground">المسؤول</div>
                      <div className="mt-1 font-medium">{report.assignedTo?.username || 'غير مُعيَّن'}</div>
                    </div>
                  </div>
                  {report.description && (
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{report.description}</p>
                  )}
                  <Link href={`/admin/reports/${report.id}`} className="block">
                    <Button variant="outline" size="sm" className="min-h-[44px] w-full justify-center gap-2">
                      <Eye className="h-4 w-4" />
                      عرض التفاصيل
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      )}
    </div>
  )
}
