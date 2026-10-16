'use client'

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartWrapper } from '@/components/admin/charts/chart-wrapper'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { SocialStatsData } from '@/hooks/use-social'

/** NOTE: TelegramDestinations lives in ./telegram-destinations (recharts-free).
 * Import it from there — never re-export it here, or the chart chunk (recharts)
 * rides along with the light summary again. */

const chartConfig = {
  published: { label: 'منشور', color: 'var(--primary)' },
  failed: { label: 'فاشل', color: 'hsl(0, 72%, 51%)' },
} satisfies ChartConfig

/**
 * مخطط النشر اليومي (تليجرام) — يُحمَّل ديناميكياً بلا SSR من صفحة المركز
 * ليتطابق مع نمط `growth-chart` في لوحة التحكم.
 */
export function TelegramByDayChart({ data }: { data: SocialStatsData }) {
  const points = data.timeSeries.map((p) => ({
    date: p.date,
    published: p.published,
    failed: p.failed,
  }))

  return (
    <ChartWrapper title="النشر اليومي" subtitle="المنشورات الناجحة والفاشلة لكل يوم">
      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} tickMargin={8} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="published"
            fill="var(--color-published)"
            fillOpacity={0.18}
            stroke="var(--color-published)"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="failed"
            stroke="var(--color-failed)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartContainer>
    </ChartWrapper>
  )
}
