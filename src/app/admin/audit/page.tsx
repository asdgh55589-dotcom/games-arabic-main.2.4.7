'use client'

import { useEffect, useState } from 'react'
import { Loader2, ScrollText, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/format'

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
        setLogs(data.logs)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      })
      .catch(() => setError('فشل تحميل سجل النشاطات'))
      .finally(() => setLoading(false))
  }, [page, actionFilter, entityFilter])

  if (loading && logs.length === 0) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">سجل النشاطات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} نشاط مسجل</p>
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">كل الإجراءات</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">كل الكيانات</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* القائمة */}
      {logs.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <ScrollText className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد نشاطات</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
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
              {logs.map((log) => (
                <tr key={log.id} className="text-sm transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{log.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                      ['delete', 'ban'].includes(log.action) ? 'bg-red-500/10 text-red-500' :
                      ['create', 'unban', 'promote'].includes(log.action) ? 'bg-green-500/10 text-green-500' :
                      ['login', 'logout'].includes(log.action) ? 'bg-blue-500/10 text-blue-500' :
                      ['warn', 'demote'].includes(log.action) ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{ENTITY_LABELS[log.entity] || log.entity}</td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell max-w-[200px] truncate">
                    {log.details || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                    {timeAgo(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
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
