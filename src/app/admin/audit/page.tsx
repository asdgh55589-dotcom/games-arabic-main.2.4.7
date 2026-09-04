// Updated for new API response format
'use client'

import { useEffect, useState } from 'react'
import { Loader2, ScrollText, Filter, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { timeAgo, formatAuditDetails } from '@/lib/format'

interface AuditLogEntry {
  id: string
  userId: string | null
  username: string
  action: string
  entity: string
  entityId: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء',
  update: 'تحديث',
  delete: 'حذف',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  moderate: 'إدارة',
  ban: 'حظر',
  unban: 'إلغاء حظر',
  warn: 'تحذير',
  promote: 'ترقية',
  demote: 'تنزيل',
  duplicate_check: 'فحص تكرار',
  create_rating: 'تقييم',
  update_rating: 'تحديث تقييم',
  create_ticket: 'إنشاء تذكرة',
  update_ticket: 'تحديث تذكرة',
  delete_ticket: 'حذف تذكرة',
  add_ticket_message: 'إضافة رسالة',
  search: 'بحث',
  export: 'تصدير',
  backup: 'نسخ احتياطي',
}

const ENTITY_LABELS: Record<string, string> = {
  mod: 'تعريب',
  game: 'لعبة',
  user: 'مستخدم',
  comment: 'تعليق',
  ad: 'إعلان',
  series: 'سلسلة',
  setting: 'إعداد',
  ip: 'عنوان IP',
  team: 'فريق',
  news: 'خبر',
  ticket: 'تذكرة',
  system: 'النظام',
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exportDays, setExportDays] = useState('30')

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '50')
    if (actionFilter) params.set('action', actionFilter)
    if (entityFilter) params.set('entity', entityFilter)
    fetch(`/api/admin/audit?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        setLogs(data.data.logs)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      })
      .catch(() => setError('فشل تحميل سجل النشاطات'))
      .finally(() => setLoading(false))
  }, [page, actionFilter, entityFilter])

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (exportDays) params.set('days', exportDays)
    if (actionFilter) params.set('action', actionFilter)
    if (entityFilter) params.set('entity', entityFilter)
    window.open(`/api/admin/audit/export?${params}`, '_blank')
  }

  const filteredLogs = searchQuery
    ? logs.filter(
        (log) =>
          log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (log.details || '').toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : logs

  // Calculate stats from current page
  const actionStats = logs.reduce(
    (acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  if (loading && logs.length === 0) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">سجل النشاطات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} نشاط مسجل</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={exportDays} onValueChange={setExportDays}>
            <SelectTrigger className="w-full max-w-[160px] sm:w-[160px]">
              <SelectValue placeholder="اختر المدة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
              <SelectItem value="90">آخر 90 يوم</SelectItem>
              <SelectItem value="365">آخر سنة</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 min-h-[44px]">
            <Download className="h-4 w-4" />
            تصدير CSV ({exportDays} يوم)
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(actionStats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([action, count]) => (
            <div key={action} className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground">{ACTION_LABELS[action] || action}</div>
              <div className="text-2xl font-bold">{count}</div>
            </div>
          ))}
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-full max-w-[200px] sm:w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في السجلات..."
            className="pr-10"
            dir="rtl"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">كل الإجراءات</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">كل الكيانات</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* القائمة */}
      {filteredLogs.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <ScrollText className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد نشاطات</h3>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-xl border border-border">
            <table className="w-full text-right">
              <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">المستخدم</th>
                  <th className="px-4 py-3 font-semibold">الإجراء</th>
                  <th className="px-4 py-3 font-semibold">الكيان</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">التفاصيل</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="text-sm transition-colors hover:bg-accent/30 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 font-medium">{log.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                          ['delete', 'ban', 'delete_ticket'].includes(log.action)
                            ? 'bg-red-500/10 text-red-500'
                            : [
                                  'create',
                                  'unban',
                                  'promote',
                                  'create_ticket',
                                  'create_rating',
                                ].includes(log.action)
                              ? 'bg-green-500/10 text-green-500'
                              : ['login', 'logout'].includes(log.action)
                                ? 'bg-blue-500/10 text-blue-500'
                                : ['warn', 'demote'].includes(log.action)
                                  ? 'bg-yellow-500/10 text-yellow-500'
                                  : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{ENTITY_LABELS[log.entity] || log.entity}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell max-w-full max-w-[200px] sm:w-[200px] truncate">
                      {log.details ? formatAuditDetails(log.action, log.details) : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                      {timeAgo(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{log.username}</div>
                      {log.userId && (
                        <div className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">
                          {log.userId}
                        </div>
                      )}
                    </div>
                    <Badge
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold border-transparent ${
                        ['delete', 'ban', 'delete_ticket'].includes(log.action)
                          ? 'bg-red-500/10 text-red-500'
                          : [
                                'create',
                                'unban',
                                'promote',
                                'create_ticket',
                                'create_rating',
                              ].includes(log.action)
                            ? 'bg-green-500/10 text-green-500'
                            : ['login', 'logout'].includes(log.action)
                              ? 'bg-blue-500/10 text-blue-500'
                              : ['warn', 'demote'].includes(log.action)
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted p-2.5">
                      <div className="font-semibold text-muted-foreground">الكيان</div>
                      <div className="mt-1 font-medium">
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </div>
                    </div>
                    <div className="rounded-md bg-muted p-2.5">
                      <div className="font-semibold text-muted-foreground">معرّف الكيان</div>
                      <div className="mt-1 truncate font-medium" dir="ltr">
                        {log.entityId || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2.5">
                    <div className="text-xs font-semibold text-muted-foreground">التفاصيل</div>
                    <div className="mt-1 break-words text-sm">
                      {log.details ? formatAuditDetails(log.action, log.details) : '—'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{timeAgo(log.createdAt)}</span>
                    <span>•</span>
                    <span>{new Date(log.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-muted-foreground">IP:</span>
                    <span dir="ltr" className="font-mono text-muted-foreground">
                      {log.ipAddress || '—'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] flex-1 justify-center gap-2"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <ScrollText className="h-4 w-4" />
                      {expandedId === log.id ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                    </Button>
                  </div>
                  {expandedId === log.id && log.details && (
                    <div className="rounded-md border border-border bg-card p-3 text-sm break-words">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        التفاصيل الكاملة
                      </div>
                      {formatAuditDetails(log.action, log.details)}
                      {log.entityId && (
                        <div className="mt-2 text-xs text-muted-foreground" dir="ltr">
                          ID: {log.entityId}
                        </div>
                      )}
                      {log.ipAddress && (
                        <div className="mt-1 text-xs text-muted-foreground" dir="ltr">
                          IP: {log.ipAddress}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}
