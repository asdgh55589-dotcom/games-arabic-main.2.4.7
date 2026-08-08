'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Flag, Filter, Package, MessageSquare, User, Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        setReports(data.reports)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      })
      .catch(() => setError('فشل تحميل البلاغات'))
      .finally(() => setLoading(false))
  }, [page, statusFilter, reasonFilter, priorityFilter, targetTypeFilter])

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
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#111214]/90 p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,80,80,0.12),transparent_30%),radial-gradient(circle_at_left,rgba(255,180,70,0.08),transparent_25%)]" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/15 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-red-300/80">
              Trust & Safety
            </div>

            <h1 className="mt-5 text-4xl font-black text-white">
              مركز البلاغات والإشراف
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-8 text-white/60">
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

      <ReportStatsCards />

      <ReportTrendChart />

      <div className="flex flex-wrap gap-3 rounded-[28px] border border-white/10 bg-[#111214]/90 p-5">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white"
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
          className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white"
        >
          <option value="">كل الأسباب</option>
          {Object.entries(REPORT_REASONS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white"
        >
          <option value="">كل الأولويات</option>
          {Object.entries(REPORT_PRIORITIES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1) }}
          className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(REPORT_TARGET_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" asChild>
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
        <div className="grid place-items-center py-20 text-center">
          <Flag className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد بلاغات</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#111214]/90">
          <table className="w-full text-right">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
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
            <tbody className="divide-y divide-white/6">
              {reports.map((report) => (
                <tr key={report.id} className="text-sm transition-colors hover:bg-white/[0.03]">
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
                   <td className="hidden px-4 py-3 text-xs text-white/60 md:table-cell">
                     {report.reporter?.username || 'مجهول'}
                   </td>
                   <td className="hidden px-4 py-3 text-xs text-white/60 md:table-cell">
                    {report.assignedTo?.username || (
                      <span className="text-muted-foreground">غير مُعيَّن</span>
                    )}
                  </td>
                   <td className="hidden px-4 py-3 text-xs text-white/40 sm:table-cell">
                     {timeAgo(report.createdAt)}
                   </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/reports/${report.id}`}>
                      <Button variant="ghost" size="sm" className="rounded-xl border border-white/10 bg-white/[0.03] text-white/60 hover:text-primary">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      )}
    </div>
  )
}
