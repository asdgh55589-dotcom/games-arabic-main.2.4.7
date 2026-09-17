'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo } from '@/lib/format'

interface ActivityRow {
  id: string
  action: string
  username: string
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  TEAM_CREATED: 'إنشاء الفريق',
  TEAM_UPDATED: 'تحديث إعدادات الفريق',
  MEMBER_REMOVED: 'إزالة عضو',
  ROLE_CHANGED: 'تغيير دور عضو',
  INVITE_CREATED: 'إنشاء دعوة',
  INVITE_REVOKED: 'إلغاء دعوة',
  INVITE_ACCEPTED: 'قبول دعوة',
  INVITE_DECLINED: 'رفض دعوة',
}

export function TeamActivity() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/creator/team/activity?page=${page}&limit=20`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setRows(json.data ?? [])
        setTotalPages(json.pagination?.totalPages || 1)
      } else {
        setError(json?.error?.message || 'فشل تحميل النشاط')
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
    }
    setLoading(false)
  }, [page])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="جارٍ التحميل">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchActivity}>
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState icon="file" title="لا يوجد نشاط بعد" description="ستظهر هنا أحداث الفريق: الانضمام، الإزالة، تغيير الأدوار، والدعوات" />
    )
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="divide-y p-0">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/40">
              <div className="min-w-0">
                <p className="text-sm font-medium">{ACTION_LABELS[r.action] ?? r.action}</p>
                <p className="truncate text-xs text-muted-foreground">بواسطة {r.username}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}
