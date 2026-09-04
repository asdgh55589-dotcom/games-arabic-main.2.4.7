'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { ChartWrapper } from './chart-wrapper'

interface Team {
  id: string
  name: string
  modsCount: number
  avgQuality: number
  totalDownloads: number
  logoUrl?: string
}

interface TopTeamsBarProps {
  teams: Team[] | undefined
  loading?: boolean
  error?: string
}

export function TopTeamsBar({ teams, loading, error }: TopTeamsBarProps) {
  const chartData = useMemo(() => {
    if (!teams) return []
    return teams.map((t) => ({
      name: t.name.length > 15 ? t.name.slice(0, 15) + '...' : t.name,
      التعريبات: t.modsCount,
      الجودة: t.avgQuality,
    }))
  }, [teams])

  const chartConfig = {
    التعريبات: { label: 'التعريبات', color: 'hsl(var(--primary))' },
    الجودة: { label: 'متوسط الجودة', color: 'hsl(142, 76%, 36%)' },
  } satisfies ChartConfig

  return (
    <ChartWrapper
      title="أفضل الفرق"
      subtitle="أعلى 10 فرق بعدد التعريبات"
      loading={loading}
      error={error}
    >
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="التعريبات" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          <Bar dataKey="الجودة" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartWrapper>
  )
}
