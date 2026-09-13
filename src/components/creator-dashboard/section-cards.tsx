"use client"

import * as React from "react"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/official-ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/official-ui/card"
import { useStudioLanguage } from "@/lib/studio-i18n/context"

interface Summary {
  totalViews: number
  viewsChange: number
  totalDownloads: number
  downloadsChange: number
  totalComments: number
  funnel?: { views: number; downloads: number; commentClicks: number; viewToDownloadPct: number; downloadToClickPct: number }
  periodLikes?: number
  periodLikesChange?: number
  newsViews?: number
  newsViewsChange?: number
}

interface Totals {
  totalMods: number
  published: number
}

export function SectionCards() {
  const { dict, formatNumber } = useStudioLanguage()
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [totals, setTotals] = React.useState<Totals | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [a, s] = await Promise.all([
          fetch("/api/creator/analytics?range=30", { cache: "no-store" }),
          fetch("/api/creator/stats", { cache: "no-store" }),
        ])
        if (a.ok) {
          const json = await a.json()
          if (!cancelled && json?.data) setSummary(json.data)
        }
        if (s.ok) {
          const json = await s.json()
          if (!cancelled && json?.data?.totals) setTotals(json.data.totals)
        }
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort section cards
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const viewsUp = (summary?.viewsChange ?? 0) >= 0
  const downloadsUp = (summary?.downloadsChange ?? 0) >= 0
  // Wave B Task 6 — funnel KPIs (same card shell, second row).
  const conversion = summary?.funnel?.viewToDownloadPct ?? 0
  const clickRate =
    summary && summary.totalViews > 0
      ? Number((((summary.funnel?.commentClicks ?? 0) / summary.totalViews) * 100).toFixed(1))
      : 0
  const periodLikes = summary?.periodLikes ?? 0
  const periodLikesUp = (summary?.periodLikesChange ?? 0) >= 0
  const newsViews = summary?.newsViews ?? 0
  const newsViewsUp = (summary?.newsViewsChange ?? 0) >= 0

  return (
    <>
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.totalViews}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {summary ? formatNumber(summary.totalViews) : "—"}
          </CardTitle>
          <div className="absolute end-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {viewsUp ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              <span dir="ltr">{summary ? `${viewsUp ? "+" : ""}${summary.viewsChange}%` : "—"}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {viewsUp ? dict.cards.upThisMonth : dict.cards.downThisMonth} <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {dict.cards.viewsLast30Days}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.totalDownloads}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {summary ? formatNumber(summary.totalDownloads) : "—"}
          </CardTitle>
          <div className="absolute end-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {downloadsUp ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              <span dir="ltr">{summary ? `${downloadsUp ? "+" : ""}${summary.downloadsChange}%` : "—"}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {downloadsUp ? dict.cards.upThisPeriod : dict.cards.downThisPeriod} <TrendingDownIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {dict.cards.downloadsNeedFollowUp}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.comments}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {summary ? formatNumber(summary.totalComments) : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {dict.cards.strongEngagement} <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">{dict.cards.commentsBeatTargets}</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.publishedMods}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
{totals ? formatNumber(totals.published) : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {dict.cards.steadyPerformance} <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">{dict.cards.meetsGrowthExpectations}</div>
        </CardFooter>
      </Card>
    </div>
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.conversion}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            <span dir="ltr">{summary ? `${conversion}%` : "—"}</span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="text-muted-foreground">
            {dict.cards.conversionDesc}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.clickRate}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            <span dir="ltr">{summary ? `${clickRate}%` : "—"}</span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="text-muted-foreground">
            {dict.cards.clickRateDesc}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.periodLikes}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {summary ? formatNumber(periodLikes) : "—"}
          </CardTitle>
          <div className="absolute end-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {periodLikesUp ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              <span dir="ltr">{summary ? `${periodLikesUp ? "+" : ""}${summary.periodLikesChange ?? 0}%` : "—"}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="text-muted-foreground">
            {dict.cards.periodLikesDesc}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{dict.cards.newsViews}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {summary ? formatNumber(newsViews) : "—"}
          </CardTitle>
          <div className="absolute end-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {newsViewsUp ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              <span dir="ltr">{summary ? `${newsViewsUp ? "+" : ""}${summary.newsViewsChange ?? 0}%` : "—"}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="text-muted-foreground">
            {dict.cards.newsViewsDesc}
          </div>
        </CardFooter>
      </Card>
    </div>
    </>
  )
}
