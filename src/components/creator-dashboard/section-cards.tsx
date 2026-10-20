"use client"

import * as React from "react"
import Link from "next/link"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCwIcon } from "lucide-react"
import { useStudioLanguage } from "@/lib/studio-i18n/context"
import { useToast } from "@/hooks/use-toast"

interface Summary {
  totalViews: number
  viewsChange: number | null
  totalDownloads: number
  downloadsChange: number | null
  totalComments: number
  funnel?: { views: number; downloads: number; commentClicks: number; viewToDownloadPct: number; downloadToClickPct: number }
  periodLikes?: number
  periodLikesChange?: number | null
  newsViews?: number
  newsViewsChange?: number | null
}

interface Totals {
  totalMods: number
  published: number
  drafts?: number
  pending?: number
  rejected?: number
  allTimeViews?: number
  allTimeDownloads?: number
  allTimeComments?: number
  averageRating?: number
}

type CardsStatus = "loading" | "ready" | "error" | "empty"

export function SectionCards() {
  const { dict, formatNumber } = useStudioLanguage()
  const { toast } = useToast()
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const [totals, setTotals] = React.useState<Totals | null>(null)
  const [status, setStatus] = React.useState<CardsStatus>("loading")
  const [reloadKey, setReloadKey] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const refreshPendingRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus("loading")
      try {
        const [a, s] = await Promise.all([
          fetch("/api/creator/analytics?range=30", { cache: "no-store" }),
          fetch("/api/creator/stats", { cache: "no-store" }),
        ])
        if (!a.ok || !s.ok) {
          if (!cancelled) {
            setStatus("error")
            if (refreshPendingRef.current) {
              refreshPendingRef.current = false
              setIsRefreshing(false)
            }
          }
          return
        }
        const aj = await a.json()
        const sj = await s.json()
        if (cancelled) return
        const hasData = Boolean(aj?.data) || Boolean(sj?.data?.totals)
        if (!hasData) {
          setStatus("empty")
          if (refreshPendingRef.current) {
            refreshPendingRef.current = false
            setIsRefreshing(false)
          }
          return
        }
        if (aj?.data) setSummary(aj.data)
        if (sj?.data?.totals) setTotals(sj.data.totals)
        setStatus("ready")
        if (refreshPendingRef.current) {
          refreshPendingRef.current = false
          setIsRefreshing(false)
          toast({ title: dict.common.refreshSuccess })
        }
      } catch (err) {
        if (!cancelled) {
          if (process.env.NODE_ENV === "development") console.error("[studio] section-cards load failed", err)
          setStatus("error")
          if (refreshPendingRef.current) {
            refreshPendingRef.current = false
            setIsRefreshing(false)
          }
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const handleRefresh = React.useCallback(() => {
    refreshPendingRef.current = true
    setIsRefreshing(true)
    setReloadKey((k) => k + 1)
  }, [])

  const viewsUp = (summary?.viewsChange ?? 0) >= 0
  const downloadsUp = (summary?.downloadsChange ?? 0) >= 0
  const conversion = summary?.funnel?.viewToDownloadPct ?? 0
  const clickRate =
    summary && summary.totalViews > 0
      ? Number((((summary.funnel?.commentClicks ?? 0) / summary.totalViews) * 100).toFixed(1))
      : 0
  const periodLikes = summary?.periodLikes ?? 0
  const periodLikesUp = (summary?.periodLikesChange ?? 0) >= 0
  const newsViews = summary?.newsViews ?? 0
  const newsViewsUp = (summary?.newsViewsChange ?? 0) >= 0

  // C1: compact KPI strip — 8 cards in @5xl/main:grid-cols-4 x 2 tight rows.
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={dict.dashboard.cardsLoading}
        className="@xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-2 gap-2 px-4 lg:px-6"
      >
         {Array.from({ length: 16 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="mx-4 flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm lg:mx-6"
      >
        <p className="font-medium">{dict.dashboard.cardsError}</p>
        <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
          {dict.dashboard.retry}
        </Button>
      </div>
    )
  }

  if (status === "empty" || (!summary && !totals)) {
    return (
      <div
        role="status"
        className="mx-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground lg:mx-6"
      >
        {dict.dashboard.cardsEmpty}
      </div>
    )
  }

  function deltaBadge(up: boolean, text: string) {
    return (
      <Badge variant="outline" className="flex shrink-0 gap-1 rounded-md px-1.5 py-0.5 text-[11px]">
        {up ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
        <span dir="ltr" className="tabular-nums">{text}</span>
      </Badge>
    )
  }

  const cards = [
    {
      key: "views",
      label: dict.cards.totalViews,
      value: summary ? formatNumber(summary.totalViews) : "0",
      badge: summary ? deltaBadge(viewsUp, summary.viewsChange === null ? "جديد" : `${viewsUp ? "+" : ""}${summary.viewsChange}%`) : null,
      hint: viewsUp ? dict.cards.upThisMonth : dict.cards.downThisMonth,
    },
    {
      key: "downloads",
      label: dict.cards.totalDownloads,
      value: summary ? formatNumber(summary.totalDownloads) : "0",
      badge: summary ? deltaBadge(downloadsUp, summary.downloadsChange === null ? "جديد" : `${downloadsUp ? "+" : ""}${summary.downloadsChange}%`) : null,
      hint: downloadsUp ? dict.cards.upThisPeriod : dict.cards.downThisPeriod,
    },
    {
      key: "comments",
      label: dict.cards.comments,
      value: summary ? formatNumber(summary.totalComments) : "0",
      badge: null,
      hint: dict.cards.strongEngagement,
    },
     {
       key: "published",
       label: dict.cards.publishedMods,
       value: totals ? formatNumber(totals.published) : "0",
       badge: null,
       hint: dict.cards.steadyPerformance,
     },
     {
       key: "drafts",
       label: dict.cards.drafts || dict.statsPage.drafts,
       value: totals ? formatNumber(totals.drafts ?? 0) : "0",
       badge: null,
       hint: dict.cards.steadyPerformance,
     },
     {
       key: "pending",
       label: dict.cards.pending || dict.statsPage.pendingReview,
       value: totals ? formatNumber(totals.pending ?? 0) : "0",
       badge: null,
       hint: dict.cards.meetsGrowthExpectations,
     },
     {
       key: "rejected",
       label: dict.cards.rejected || dict.statsPage.rejected,
       value: totals ? formatNumber(totals.rejected ?? 0) : "0",
       badge: null,
       hint: dict.cards.downloadsNeedFollowUp,
     },
     {
       key: "allTimeViews",
       label: dict.cards.allTimeViews || dict.statsPage.lifetime,
       value: totals ? formatNumber(totals.allTimeViews ?? 0) : "0",
       badge: null,
       hint: dict.statsPage.lifetime,
     },
     {
       key: "allTimeDownloads",
       label: dict.cards.allTimeDownloads || dict.statsPage.lifetime,
       value: totals ? formatNumber(totals.allTimeDownloads ?? 0) : "0",
       badge: null,
       hint: dict.statsPage.lifetime,
     },
     {
       key: "allTimeComments",
       label: dict.cards.allTimeComments || dict.statsPage.lifetime,
       value: totals ? formatNumber(totals.allTimeComments ?? 0) : "0",
       badge: null,
       hint: dict.statsPage.lifetime,
     },
     {
       key: "averageRating",
       label: dict.cards.averageRating || dict.statsPage.avgRating,
       value: totals ? formatNumber(totals.averageRating ?? 0) : "0",
       badge: null,
       hint: dict.statsPage.avgRating,
     },
    {
      key: "conversion",
      label: dict.cards.conversion,
      value: `${conversion}%`,
      badge: null,
      hint: dict.cards.conversionDesc,
    },
    {
      key: "clickRate",
      label: dict.cards.clickRate,
      value: `${clickRate}%`,
      badge: null,
      hint: dict.cards.clickRateDesc,
    },
    {
      key: "likes",
      label: dict.cards.periodLikes,
      value: summary ? formatNumber(periodLikes) : "0",
      badge: summary ? deltaBadge(periodLikesUp, summary.periodLikesChange === null ? "جديد" : `${periodLikesUp ? "+" : ""}${summary.periodLikesChange ?? 0}%`) : null,
      hint: dict.cards.periodLikesDesc,
    },
    {
      key: "news",
      label: dict.cards.newsViews,
      value: summary ? formatNumber(newsViews) : "0",
      badge: summary ? deltaBadge(newsViewsUp, summary.newsViewsChange === null ? "جديد" : `${newsViewsUp ? "+" : ""}${summary.newsViewsChange ?? 0}%`) : null,
      hint: dict.cards.newsViewsDesc,
    },
  ]

  const cardLinks: Record<string, string> = {
    published: "/creator/mods?status=published",
    drafts: "/creator/mods?status=draft",
    pending: "/creator/mods?status=pending",
    rejected: "/creator/mods?status=rejected",
    comments: "/creator/comments",
  }

  return (
    <>
      <div className="flex items-center justify-end px-4 lg:px-6">
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCwIcon className={`me-1 size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {dict.common.refresh}
        </Button>
      </div>
      <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-2 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card lg:px-6">
      {cards.map((c) => {
        const link = cardLinks[c.key]
        const card = (
          <Card className="@container/card gap-1 py-3">
            <CardHeader className="relative gap-0 px-3">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="truncate text-xs">{c.label}</CardDescription>
                {c.badge}
              </div>
              <CardTitle className="text-xl font-semibold tabular-nums" dir="auto">
                <span dir="ltr">{c.value}</span>
              </CardTitle>
            </CardHeader>
            <CardFooter className="px-3 pt-0 text-xs text-muted-foreground">
              <div className="line-clamp-1">{c.hint}</div>
            </CardFooter>
          </Card>
        )
        if (link) {
          return (
            <Link key={c.key} href={link} className="block">
              {card}
            </Link>
          )
        }
        return <React.Fragment key={c.key}>{card}</React.Fragment>
      })}
    </div>
    </>
  )
}
