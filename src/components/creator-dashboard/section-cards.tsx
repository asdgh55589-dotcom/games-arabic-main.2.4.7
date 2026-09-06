"use client"

import * as React from "react"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Summary {
  totalViews: number
  viewsChange: number
  totalDownloads: number
  downloadsChange: number
  totalComments: number
}

interface Totals {
  totalMods: number
  published: number
}

export function SectionCards() {
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
        // keep placeholders on failure
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const viewsUp = (summary?.viewsChange ?? 0) >= 0
  const downloadsUp = (summary?.downloadsChange ?? 0) >= 0

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>إجمالي المشاهدات</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {summary ? summary.totalViews.toLocaleString("ar-EG") : "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {viewsUp ? <IconTrendingUp /> : <IconTrendingDown />}
              {summary ? `${viewsUp ? "+" : ""}${summary.viewsChange}%` : "—"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {viewsUp ? "ارتفاع هذا الشهر" : "انخفاض هذا الشهر"}{" "}
            {viewsUp ? (
              <IconTrendingUp className="size-4" />
            ) : (
              <IconTrendingDown className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground">المشاهدات آخر 30 يومًا</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>التحميلات</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {summary ? summary.totalDownloads.toLocaleString("ar-EG") : "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {downloadsUp ? <IconTrendingUp /> : <IconTrendingDown />}
              {summary
                ? `${downloadsUp ? "+" : ""}${summary.downloadsChange}%`
                : "—"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {downloadsUp ? "ارتفاع هذه الفترة" : "انخفاض هذه الفترة"}{" "}
            {downloadsUp ? (
              <IconTrendingUp className="size-4" />
            ) : (
              <IconTrendingDown className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground">التحميلات تحتاج متابعة</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>التعليقات</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {summary ? summary.totalComments.toLocaleString("ar-EG") : "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            تفاعل قوي <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">التعليقات تتجاوز الأهداف</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>تعريبات منشورة</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totals ? totals.published.toLocaleString("ar-EG") : "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            أداء ثابت <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">يواكب توقعات النمو</div>
        </CardFooter>
      </Card>
    </div>
  )
}
