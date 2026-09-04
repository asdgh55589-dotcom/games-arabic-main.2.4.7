// Updated for new API response format
'use client'

import { useEffect, useState } from 'react'
import { Loader2, ThumbsUp, ThumbsDown, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber, timeAgo } from '@/lib/format'

interface Endorsement {
  id: string
  value: string
  createdAt: string
  user: { id: string; username: string; avatarUrl: string | null }
  mod: { id: string; name: string; slug: string }
}

interface TopMod {
  id: string
  name: string
  slug: string
  endorsements: number
}

export default function AdminEndorsementsPage() {
  const [endorsements, setEndorsements] = useState<Endorsement[]>([])
  const [topMods, setTopMods] = useState<TopMod[]>([])
  const [stats, setStats] = useState({ up: 0, down: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '50')
    fetch(`/api/admin/endorsements?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        setEndorsements(data.data.endorsements)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
        setStats(data.data.stats)
        setTopMods(data.data.topMods)
      })
      .catch(() => setError('فشل تحميل التأييدات'))
      .finally(() => setLoading(false))
  }, [page])

  if (loading) {
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">التأييدات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} تأييد إجمالي</p>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <ThumbsUp className="mx-auto h-5 w-5 text-green-500" />
          <div className="mt-1 text-2xl font-bold">{formatNumber(stats.up)}</div>
          <div className="text-xs text-muted-foreground">إيجابي</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <ThumbsDown className="mx-auto h-5 w-5 text-red-500" />
          <div className="mt-1 text-2xl font-bold">{formatNumber(stats.down)}</div>
          <div className="text-xs text-muted-foreground">سلبي</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <ThumbsUp className="mx-auto h-5 w-5 text-primary" />
          <div className="mt-1 text-2xl font-bold">{formatNumber(stats.total)}</div>
          <div className="text-xs text-muted-foreground">الإجمالي</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* أكثر التعريبات تأييداً */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-1">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Trophy className="h-4 w-4 text-amber-500" />
            الأكثر تأييداً
          </h2>
          <div className="space-y-2">
            {topMods.map((mod, i) => (
              <div
                key={mod.id}
                className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent/30"
              >
                <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{mod.name}</span>
                <span className="text-xs text-primary">{formatNumber(mod.endorsements)}</span>
              </div>
            ))}
            {topMods.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد تأييدات</p>
            )}
          </div>
        </div>

        {/* آخر التأييدات */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold">آخر التأييدات</h2>
          <div className="space-y-2">
            {endorsements.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-accent/30"
              >
                {e.value === 'up' ? (
                  <ThumbsUp className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <ThumbsDown className="h-4 w-4 shrink-0 text-red-500" />
                )}
                <span className="font-medium">{e.user.username}</span>
                <span className="text-muted-foreground">أيّد</span>
                <span className="font-medium text-primary">{e.mod.name}</span>
                <span className="mr-auto text-xs text-muted-foreground">
                  {timeAgo(e.createdAt)}
                </span>
              </div>
            ))}
            {endorsements.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد تأييدات</p>
            )}
          </div>
        </div>
      </div>

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
