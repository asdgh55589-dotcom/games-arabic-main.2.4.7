'use client'

import { useMemo } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import { ChartWrapper } from './chart-wrapper'

interface GrowthData {
  months: string[]
  modsPublished: number[]
  newUsers: number[]
  downloads: number[]
}

interface GrowthChartProps {
  data: GrowthData | undefined
  loading?: boolean
  error?: string
  timeRange?: string
  onTimeRangeChange?: (range: string) => void
}

const chartConfig = {
  modsPublished: { label: 'التعريبات المنشورة', color: 'hsl(var(--primary))' },
  newUsers: { label: 'مستخدمون جدد', color: 'hsl(142, 76%, 36%)' },
  downloads: { label: 'التحميلات', color: 'hsl(47, 100%, 50%)' },
} satisfies ChartConfig

export function GrowthChart({ data, loading, error, timeRange = '12', onTimeRangeChange }: GrowthChartProps) {
  const chartData = useMemo(() => {
    if (!data) return []
    return data.months.map((month, i) => ({
      name: month,
      التعريبات: data.modsPublished[i],
      المستخدمون: data.newUsers[i],
      التحميلات: data.downloads[i],
    }))
  }, [data])

  return (
    <ChartWrapper
      title="النمو"
      subtitle="التعريبات والمستخدمون والتحميلات عبر الزمن"
      loading={loading}
      error={error}
      action={
        onTimeRangeChange && (
          <div className="flex gap-1">
            {['6', '12', '24'].map((r) => (
              <button
                key={r}
                onClick={() => onTimeRangeChange(r)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  timeRange === r
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {r} شهر
              </button>
            ))}
          </div>
        )
      }
    >
      <ChartContainer config={chartConfig} className="h-[350px] w-full">
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="gradMods" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="farRight" orientation="right" tick={{ fontSize: 11 }} hide />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="التعريبات"
            fill="url(#gradMods)"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="المستخدمون"
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="farRight"
            type="monotone"
            dataKey="التحميلات"
            stroke="hsl(47, 100%, 50%)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
          />
        </ComposedChart>
      </ChartContainer>
    </ChartWrapper>
  )
}
