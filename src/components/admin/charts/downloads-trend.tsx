'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartWrapper } from './chart-wrapper'

interface DailyTrend {
  date: string
  count: number
}

interface DownloadsTrendProps {
  data: DailyTrend[] | undefined
  loading?: boolean
  error?: string
}

const chartConfig = {
  count: { label: 'التحميلات', color: 'hsl(var(--primary))' },
} satisfies ChartConfig

export function DownloadsTrend({ data, loading, error }: DownloadsTrendProps) {
  const chartData = useMemo(() => {
    if (!data) return []
    return data.map((d) => ({
      date: new Date(d.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      التحميلات: d.count,
    }))
  }, [data])

  return (
    <ChartWrapper
      title="اتجاه التحميلات"
      subtitle="التحميلات اليومية (آخر 30 يوم)"
      loading={loading}
      error={error}
    >
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="gradDownloads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="التحميلات"
            stroke="hsl(var(--primary))"
            fill="url(#gradDownloads)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </ChartWrapper>
  )
}
