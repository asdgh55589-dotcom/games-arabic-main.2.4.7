'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

interface SlimMod {
  id: string
  name: string
  slug: string
  workflowStatus: string
  downloads: number
  rating: number
}

interface StatsData {
  stats: {
    totalMods: number
    publishedMods: number
    totalDownloads: number
    totalEndorsements: number
    avgRating: number
    avgQuality: number
  }
  byStatus: Record<string, number>
  topMods: SlimMod[]
  lowestMods: SlimMod[]
  memberCount: number
  followsCount: number
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  APPROVED: 'مقبول',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
  REJECTED: 'مرفوض',
}

function ModRow({ mod }: { mod: SlimMod }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <Link href={`/mod/${mod.slug}`} className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline">
        {mod.name}
      </Link>
      <span className="shrink-0 text-xs text-muted-foreground">
        {mod.downloads} تحميل · {mod.rating.toFixed(1)} ★
      </span>
    </div>
  )
}

export function TeamStats() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/team/stats', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setData(json.data)
      } else {
        setError(json?.error?.message || 'فشل تحميل الإحصائيات')
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy="true" aria-label="جارٍ التحميل">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-destructive">{error ?? 'فشل تحميل الإحصائيات'}</p>
          <Button variant="outline" size="sm" onClick={fetchStats}>
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    )
  }

  const cards = [
    { label: 'إجمالي التحميلات', value: data.stats.totalDownloads.toLocaleString('ar') },
    { label: 'التأييدات', value: data.stats.totalEndorsements.toLocaleString('ar') },
    { label: 'متوسط التقييم', value: data.stats.avgRating.toFixed(1) },
    { label: 'متوسط الجودة', value: `${Math.round(data.stats.avgQuality)}%` },
    { label: 'الأعضاء', value: String(data.memberCount) },
    { label: 'المتابعون', value: String(data.followsCount) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <p className="text-xs text-muted-foreground md:text-sm">{c.label}</p>
              <p className="mt-1 text-2xl font-bold md:text-3xl">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">التعريبات حسب الحالة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(data.byStatus).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد تعريبات مرتبطة بعد</p>
            )}
            {Object.entries(data.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <Badge variant="secondary">{STATUS_LABELS[status] ?? status}</Badge>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">الأعلى تقييماً</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topMods.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد</p>
            ) : (
              data.topMods.map((m) => <ModRow key={m.id} mod={m} />)
            )}
          </CardContent>
        </Card>
      </div>

      {data.lowestMods.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">يحتاج تحسيناً</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowestMods.map((m) => <ModRow key={m.id} mod={m} />)}
          </CardContent>
        </Card>
      )}

      {data.stats.totalMods === 0 && (
        <EmptyState icon="file" title="لا توجد تعريبات مرتبطة" description="اربط تعريباتك بالفريق من تبويب المودات لعرض الإحصائيات" />
      )}
    </div>
  )
}
