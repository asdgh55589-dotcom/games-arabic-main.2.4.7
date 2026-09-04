'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartWrapper } from './chart-wrapper'

interface EngagementData {
  comments: { date: string; count: number }[]
  endorsements: { date: string; count: number }[]
  activeUsers: { date: string; count: number }[]
  avgDailyActive: number
}

interface EngagementChartProps {
  data: EngagementData | undefined
  loading?: boolean
  error?: string
}

const chartConfig = {
  التعليقات: { label: 'التعليقات', color: 'hsl(var(--primary))' },
  التأييدات: { label: 'التأييدات', color: 'hsl(142, 76%, 36%)' },
  'المستخدمون النشطون': { label: 'المستخدمون النشطون', color: 'hsl(47, 100%, 50%)' },
} satisfies ChartConfig

export function EngagementChart({ data, loading, error }: EngagementChartProps) {
  const chartData = useMemo(() => {
    if (!data) return []
    const dateMap = new Map<string, { date: string }>()
    data.comments.forEach((d) => {
      if (!dateMap.has(d.date)) dateMap.set(d.date, { date: d.date })
    })

    return Array.from(dateMap.values())
      .map((d) => {
        const comments = data.comments.find((c) => c.date === d.date)?.count || 0
        const endorsements = data.endorsements.find((c) => c.date === d.date)?.count || 0
        const active = data.activeUsers.find((c) => c.date === d.date)?.count || 0
        return {
          date: new Date(d.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
          التعليقات: comments,
          التأييدات: endorsements,
          'المستخدمون النشطون': active,
        }
      })
      .sort((a, b) => {
        // Sort by date
        const da = new Date(a.date)
        const db = new Date(b.date)
        return da.getTime() - db.getTime()
      })
  }, [data])

  return (
    <ChartWrapper
      title="تفاعل المستخدمين"
      subtitle="التعليقات والتأييدات والمستخدمون النشطون"
      loading={loading}
      error={error}
    >
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey="التعليقات"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="التأييدات"
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="المستخدمون النشطون"
            stroke="hsl(47, 100%, 50%)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </ChartWrapper>
  )
}
