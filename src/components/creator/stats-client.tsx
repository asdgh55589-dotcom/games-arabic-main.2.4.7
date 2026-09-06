'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo } from '@/lib/format'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

interface AnalyticsSummary {
  totalViews: number
  viewsChange: number
  totalDownloads: number
  downloadsChange: number
  totalComments: number
  funnel?: { viewToDownloadPct: number; downloadToClickPct: number }
}

interface StatsTotals {
  totalMods: number
  published: number
  drafts: number
  pending: number
  rejected: number
  totalViews: number
  totalDownloads: number
  totalEndorsements: number
  totalComments: number
  averageRating: number
}

interface TopMod {
  id: string
  name: string
  slug: string
  downloads: number
  views: number
  rating: number
}

interface RecentItem {
  id: string
  name: string
  status: string
  createdAt: string
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  PUBLISHED: 'default',
  DRAFT: 'secondary',
  IN_REVIEW: 'outline',
  REJECTED: 'destructive',
}

export function StatsClient() {
  const { dict, locale, formatNumber } = useStudioLanguage()
  const t = dict.statsPage
  const [range, setRange] = useState(30)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [totals, setTotals] = useState<StatsTotals | null>(null)
  const [topMods, setTopMods] = useState<TopMod[]>([])
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([
        fetch(`/api/creator/analytics?range=${range}`, { cache: 'no-store' }),
        fetch('/api/creator/stats', { cache: 'no-store' }),
      ])
      if (a.ok) {
        const json = await a.json()
        if (json?.data) setSummary(json.data)
      }
      if (s.ok) {
        const json = await s.json()
        if (json?.data?.totals) setTotals(json.data.totals)
        if (json?.data?.topMods) setTopMods(json.data.topMods)
        if (json?.data?.recentActivity) setRecent(json.data.recentActivity)
      }
    } catch {
      // empty states on failure
    }
    setLoading(false)
  }, [range])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-muted-foreground">{t.period}:</span>
        {[7, 30, 90].map((r) => (
          <Button key={r} variant={range === r ? 'default' : 'outline'} size="sm" onClick={() => setRange(r)}>
            <span dir="ltr">{r}d</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">…</div>
      ) : !totals || totals.totalMods === 0 ? (
        <EmptyState icon="file" title={t.empty} description={t.subtitle} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.views}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary?.totalViews ?? 0)}</div>
                <div className="text-xs" dir="ltr">
                  {(summary?.viewsChange ?? 0) >= 0 ? '+' : ''}{summary?.viewsChange ?? 0}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.downloads}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary?.totalDownloads ?? 0)}</div>
                <div className="text-xs" dir="ltr">
                  {(summary?.downloadsChange ?? 0) >= 0 ? '+' : ''}{summary?.downloadsChange ?? 0}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.endorsements}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totals.totalEndorsements)}</div>
                <div className="text-xs text-muted-foreground">
                  {t.avgRating}: {totals.averageRating}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.comments}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary?.totalComments ?? totals.totalComments)}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {t.lifetime}: {formatNumber(totals.totalComments)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Badge variant="default">{t.published}: {formatNumber(totals.published)}</Badge>
            <Badge variant="secondary">{t.drafts}: {formatNumber(totals.drafts)}</Badge>
            <Badge variant="outline">{t.pendingReview}: {formatNumber(totals.pending)}</Badge>
            <Badge variant="destructive">{t.rejected}: {formatNumber(totals.rejected)}</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.topMods}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topMods.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm flex-wrap">
                    <Link href={`/mod/${m.slug}`} target="_blank" className="font-medium text-primary hover:underline">
                      {m.name}
                    </Link>
                    <span className="text-muted-foreground ms-auto">
                      {formatNumber(m.downloads)} {t.downloads} • {formatNumber(m.views)} {t.views} • {m.rating.toFixed(1)} {t.rating}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.recentActivity}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'} className="text-xs">
                      {r.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground ms-auto">
                      {timeAgo(r.createdAt, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
