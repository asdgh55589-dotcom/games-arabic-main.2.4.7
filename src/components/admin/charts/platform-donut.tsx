'use client'

import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { ChartWrapper } from './chart-wrapper'

interface Platform {
  name: string
  count: number
  percentage: number
  trend: number
}

interface PlatformDonutProps {
  platforms: Platform[] | undefined
  loading?: boolean
  error?: string
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(47, 100%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(32, 95%, 44%)',
]

export function PlatformDonut({ platforms, loading, error }: PlatformDonutProps) {
  const chartData = useMemo(() => {
    if (!platforms) return []
    return platforms.map((p) => ({
      name: p.name,
      value: p.count,
    }))
  }, [platforms])

  const total = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData])

  const config: ChartConfig = useMemo(() => {
    const c: ChartConfig = {}
    platforms?.forEach((p, i) => {
      c[p.name] = { label: p.name, color: COLORS[i % COLORS.length] }
    })
    return c
  }, [platforms])

  return (
    <ChartWrapper
      title="التوزيع حسب المنصة"
      subtitle="نسبة التعريبات لكل منصة"
      loading={loading}
      error={error}
    >
      <ChartContainer config={config} className="h-[300px] w-full">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {/* Center label */}
          <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-lg font-bold">
            {total}
          </text>
          <text x="50%" y="58%" textAnchor="middle" className="fill-muted-foreground text-xs">
            إجمالي
          </text>
        </PieChart>
      </ChartContainer>
    </ChartWrapper>
  )
}
