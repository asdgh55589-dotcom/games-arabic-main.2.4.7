'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface AnalyticsSummary {
  totalViews: number
  viewsChange: number
  totalDownloads: number
  downloadsChange: number
  totalComments: number
  totalLikes: number
  newModsThisPeriod: number
  activeModsCount: number
}

interface StatsTotals {
  totalMods: number
  published: number
  drafts: number
  pending: number
  rejected: number
}

function ChangeBadge({ value }: { value: number }) {
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <Badge variant="outline" aria-label={`التغير ${value}%`}>
      <Icon className="size-4" aria-hidden="true" />
      {up ? '+' : ''}
      {value}%
    </Badge>
  )
}

function MetricCard({
  label,
  value,
  change,
  hint,
}: {
  label: string
  value: string
  change?: number
  hint: string
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          <bdi>{value}</bdi>
        </CardTitle>
        {change !== undefined && (
          <CardAction>
            <ChangeBadge value={change} />
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="text-muted-foreground">{hint}</div>
      </CardFooter>
    </Card>
  )
}

export function SectionCards() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [totals, setTotals] = useState<StatsTotals | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [aRes, sRes] = await Promise.all([
          fetch('/api/creator/analytics?range=30', { cache: 'no-store' }),
          fetch('/api/creator/stats', { cache: 'no-store' }),
        ])
        const [aJson, sJson] = await Promise.all([aRes.json(), sRes.json()])
        if (cancelled) return
        if (aRes.ok && aJson.data) setAnalytics(aJson.data)
        if (sRes.ok && sJson.data?.totals) setTotals(sJson.data.totals)
      } catch (err) {
        console.error('[creator-dashboard] section-cards load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4"
        role="status"
        aria-label="جاري تحميل الإحصائيات"
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[140px] w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <MetricCard
        label="إجمالي المشاهدات (30 يوم)"
        value={(analytics?.totalViews ?? 0).toLocaleString('ar-EG')}
        change={analytics?.viewsChange}
        hint="مقارنة بالفترة السابقة"
      />
      <MetricCard
        label="إجمالي التحميلات (30 يوم)"
        value={(analytics?.totalDownloads ?? 0).toLocaleString('ar-EG')}
        change={analytics?.downloadsChange}
        hint="مقارنة بالفترة السابقة"
      />
      <MetricCard
        label="التعريبات المنشورة"
        value={(totals?.published ?? 0).toLocaleString('ar-EG')}
        hint={`المسودات: ${(totals?.drafts ?? 0).toLocaleString('ar-EG')} — قيد المراجعة: ${(totals?.pending ?? 0).toLocaleString('ar-EG')}`}
      />
      <MetricCard
        label="التعليقات (30 يوم)"
        value={(analytics?.totalComments ?? 0).toLocaleString('ar-EG')}
        hint={`الإعجابات: ${(analytics?.totalLikes ?? 0).toLocaleString('ar-EG')} — تعريبات نشطة: ${(analytics?.activeModsCount ?? 0).toLocaleString('ar-EG')}`}
      />
    </div>
  )
}
