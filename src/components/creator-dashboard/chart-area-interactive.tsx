"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { useStudioLanguage } from "@/lib/studio-i18n/context"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/official-ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/official-ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/official-ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/official-ui/toggle-group"
interface HistoryPoint {
  date: string
  desktop: number
  mobile: number
  clicks: number
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const { dict, formatShortDate } = useStudioLanguage()
  // Series 2 toggles downloads ↔ comment-clicks (design shell unchanged).
  const [seriesMode, setSeriesMode] = React.useState<'downloads' | 'clicks'>('downloads')
  // Labels drive the tooltip/legend — translated at render; colors stay static.
  const chartConfig = React.useMemo(
    () =>
      ({
        visitors: { label: dict.chart.visitors },
        desktop: { label: dict.chart.views, color: "var(--chart-1)" },
        mobile: {
          label: seriesMode === 'downloads' ? dict.chart.downloads : dict.chart.commentClicks,
          color: "var(--chart-2)",
        },
      }) satisfies ChartConfig,
    [dict, seriesMode]
  )
  const [timeRange, setTimeRange] = React.useState("30d")
  const [chartData, setChartData] = React.useState<HistoryPoint[]>([])

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const range = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
        const res = await fetch(
          `/api/creator/analytics/history?range=${range}`,
          { cache: "no-store" }
        )
        if (!res.ok) return
        const json = await res.json()
        const views: { date: string; count: number }[] =
          json?.data?.views ?? []
        const downloads: { date: string; count: number }[] =
          json?.data?.downloads ?? []
        const clicks: { date: string; count: number }[] =
          json?.data?.commentClicks ?? []
        const byDate = new Map<string, HistoryPoint>()
        for (const v of views) {
          byDate.set(v.date, { date: v.date, desktop: v.count, mobile: 0, clicks: 0 })
        }
        for (const d of downloads) {
          const cur = byDate.get(d.date) ?? {
            date: d.date,
            desktop: 0,
            mobile: 0,
            clicks: 0,
          }
          cur.mobile = d.count
          byDate.set(d.date, cur)
        }
        for (const k of clicks) {
          const cur = byDate.get(k.date) ?? {
            date: k.date,
            desktop: 0,
            mobile: 0,
            clicks: 0,
          }
          cur.clicks = k.count
          byDate.set(k.date, cur)
        }
        if (!cancelled) {
          setChartData(
            [...byDate.values()].sort((a, b) =>
              a.date < b.date ? -1 : a.date > b.date ? 1 : 0
            )
          )
        }
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort chart operation
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [timeRange])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  // Series-2 source switch (same shell, same colors — only the data + label change).
  const displayData = React.useMemo(
    () =>
      seriesMode === 'downloads'
        ? filteredData
        : filteredData.map((d) => ({ ...d, mobile: d.clicks })),
    [filteredData, seriesMode]
  )

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>{dict.chart.title}</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            {dict.chart.totalLast3Months}
          </span>
          <span className="@[540px]/card:hidden">{dict.chart.last3Months}</span>
        </CardDescription>
        <div className="absolute end-4 top-4 flex flex-col items-end gap-2">
          <ToggleGroup
            type="single"
            value={seriesMode}
            onValueChange={(v) => v && setSeriesMode(v as 'downloads' | 'clicks')}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="downloads" className="h-8 px-2.5">
              {dict.chart.downloads}
            </ToggleGroupItem>
            <ToggleGroupItem value="clicks" className="h-8 px-2.5">
              {dict.chart.commentClicks}
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5">
              {dict.chart.last3Months}
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              {dict.chart.last30Days}
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              {dict.chart.last7Days}
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-40"
              aria-label={dict.chart.pickRange}
            >
              <SelectValue placeholder={dict.chart.last3Months} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                {dict.chart.last3Months}
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                {dict.chart.last30Days}
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                {dict.chart.last7Days}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={displayData}>
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-desktop)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => formatShortDate(value)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatShortDate(value)}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="mobile"
              type="natural"
              fill="url(#fillMobile)"
              stroke="var(--color-mobile)"
              stackId="a"
            />
            <Area
              dataKey="desktop"
              type="natural"
              fill="url(#fillDesktop)"
              stroke="var(--color-desktop)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
