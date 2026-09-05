'use client'

import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export const description = 'مخطط المشاهدات والتحميلات اليومية للمُعَرِّب'

interface DayPoint {
  date: string
  count: number
}

const chartConfig = {
  views: {
    label: 'المشاهدات',
    color: 'var(--primary)',
  },
  downloads: {
    label: 'التحميلات',
    color: 'var(--gold)',
  },
} satisfies ChartConfig

function formatDayTick(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState('30')
  const [views, setViews] = React.useState<DayPoint[]>([])
  const [downloads, setDownloads] = React.useState<DayPoint[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [retryKey, setRetryKey] = React.useState(0)

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('7')
    }
  }, [isMobile])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/creator/analytics/history?range=${timeRange}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        if (cancelled) return
        if (res.ok && json.data) {
          setViews(json.data.views ?? [])
          setDownloads(json.data.downloads ?? [])
        } else {
          setError(true)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[creator-dashboard] chart load failed:', err)
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [timeRange, retryKey])

  const chartData = React.useMemo(() => {
    const dlByDate = new Map(downloads.map((d) => [d.date, d.count]))
    return views.map((v) => ({ date: v.date, views: v.count, downloads: dlByDate.get(v.date) ?? 0 }))
  }, [views, downloads])

  const isEmpty = !loading && !error && chartData.every((d) => d.views === 0 && d.downloads === 0)

  const rangeLabel = timeRange === '7' ? 'آخر 7 أيام' : timeRange === '30d' || timeRange === '30' ? 'آخر 30 يوم' : 'آخر 90 يوم'

  return (
    <Card className="@container/card" dir="rtl">
      <CardHeader>
        <CardTitle>المشاهدات والتحميلات</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">إجمالي النشاط اليومي لتعريباتك</span>
          <span className="@[540px]/card:hidden">النشاط اليومي</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
            aria-label="اختر الفترة الزمنية"
          >
            <ToggleGroupItem value="90">آخر 90 يوم</ToggleGroupItem>
            <ToggleGroupItem value="30">آخر 30 يوم</ToggleGroupItem>
            <ToggleGroupItem value="7">آخر 7 أيام</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="اختر الفترة الزمنية"
            >
              <SelectValue placeholder={rangeLabel} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90" className="rounded-lg">
                آخر 90 يوم
              </SelectItem>
              <SelectItem value="30" className="rounded-lg">
                آخر 30 يوم
              </SelectItem>
              <SelectItem value="7" className="rounded-lg">
                آخر 7 أيام
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div role="status" aria-label="جاري تحميل المخطط">
            <Skeleton className="h-[250px] w-full" />
          </div>
        ) : error ? (
          <div className="grid h-[250px] place-items-center text-center" role="alert">
            <div>
              <p className="text-sm font-bold text-destructive">فشل تحميل المخطط</p>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="mt-2 min-h-[44px] text-xs text-muted-foreground underline"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        ) : isEmpty ? (
          <div className="grid h-[250px] place-items-center text-center">
            <div>
              <p className="text-sm font-bold">لا توجد بيانات بعد</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ستظهر هنا مشاهدات وتحميلات تعريباتك
              </p>
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-views)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillDownloads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-downloads)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-downloads)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={formatDayTick}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={formatDayTick}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="downloads"
                type="natural"
                fill="url(#fillDownloads)"
                stroke="var(--color-downloads)"
                stackId="a"
              />
              <Area
                dataKey="views"
                type="natural"
                fill="url(#fillViews)"
                stroke="var(--color-views)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
