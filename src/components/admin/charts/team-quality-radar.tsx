'use client'

import { useMemo, useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ChartWrapper } from './chart-wrapper'

interface TeamMetrics {
  name: string
  metrics: {
    quality: number
    completion: number
    responseTime: number
    satisfaction: number
    consistency: number
  }
}

interface TeamQualityRadarProps {
  teams: TeamMetrics[] | undefined
  loading?: boolean
  error?: string
}

const METRICS = [
  { key: 'quality', label: 'الجودة' },
  { key: 'completion', label: 'الإنجاز' },
  { key: 'responseTime', label: 'سرعة الاستجابة' },
  { key: 'satisfaction', label: 'الرضا' },
  { key: 'consistency', label: 'الاستمرارية' },
]

const TEAM_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(47, 100%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
]

export function TeamQualityRadar({ teams, loading, error }: TeamQualityRadarProps) {
  const [hoveredTeam, setHoveredTeam] = useState<number | null>(null)

  const chartData = useMemo(() => {
    if (!teams) return []
    return METRICS.map((m) => {
      const entry: Record<string, string | number> = { metric: m.label }
      teams.forEach((t) => {
        entry[t.name] = t.metrics[m.key as keyof typeof t.metrics]
      })
      return entry
    })
  }, [teams])

  return (
    <ChartWrapper
      title="مقارنة جودة الفرق"
      subtitle="أداء الفرق عبر 5 معايير"
      loading={loading}
      error={error}
    >
      <div className="h-[350px] w-full">
        <ResponsiveContainer>
          <RadarChart data={chartData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
            {teams?.map((team, i) => (
              <Radar
                key={team.name}
                name={team.name}
                dataKey={team.name}
                stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                fill={TEAM_COLORS[i % TEAM_COLORS.length]}
                fillOpacity={hoveredTeam === null ? 0.15 : hoveredTeam === i ? 0.3 : 0.05}
                strokeWidth={hoveredTeam === i ? 3 : 2}
                onMouseEnter={() => setHoveredTeam(i)}
                onMouseLeave={() => setHoveredTeam(null)}
              />
            ))}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                    <div className="font-medium mb-1">{payload[0]?.payload?.metric}</div>
                    {payload.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }} />
                        <span className="text-muted-foreground">{p.name}:</span>
                        <span className="font-medium">{String(p.value)}</span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              onMouseEnter={(_, idx) => setHoveredTeam(idx)}
              onMouseLeave={() => setHoveredTeam(null)}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  )
}
