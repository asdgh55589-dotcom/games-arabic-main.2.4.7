'use client'

import { useMemo, useState } from 'react'
import { ChartWrapper } from './chart-wrapper'

interface HeatmapCell {
  day: number
  hour: number
  count: number
}

interface ActivityHeatmapProps {
  data: HeatmapCell[] | undefined
  maxCount?: number
  loading?: boolean
  error?: string
}

const DAY_LABELS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function getColorIntensity(count: number, max: number): string {
  if (max === 0 || count === 0) return 'transparent'
  const ratio = count / max
  if (ratio < 0.25) return 'hsl(var(--primary) / 0.15)'
  if (ratio < 0.5) return 'hsl(var(--primary) / 0.35)'
  if (ratio < 0.75) return 'hsl(var(--primary) / 0.6)'
  return 'hsl(var(--primary) / 0.85)'
}

export function ActivityHeatmap({ data, maxCount = 1, loading, error }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    day: number
    hour: number
    count: number
    x: number
    y: number
  } | null>(null)

  const grid = useMemo(() => {
    if (!data) return []
    const map = new Map<string, number>()
    data.forEach((d) => map.set(`${d.day}-${d.hour}`, d.count))
    return DAY_LABELS.map((day, dayIdx) =>
      Array.from({ length: 24 }, (_, hour) => ({
        day: dayIdx,
        hour,
        count: map.get(`${dayIdx}-${hour}`) || 0,
      })),
    )
  }, [data])

  return (
    <ChartWrapper
      title="خريطة النشاط"
      subtitle="نشاط المستخدمين حسب اليوم والساعة (آخر 30 يوم)"
      loading={loading}
      error={error}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="mb-1 flex gap-0.5 pr-[60px]">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground">
                {i % 3 === 0 ? `${String(i).padStart(2, '0')}` : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          {grid.map((row, dayIdx) => (
            <div key={dayIdx} className="mb-0.5 flex items-center gap-0.5">
              <div className="w-[58px] text-right text-[10px] text-muted-foreground">
                {DAY_LABELS[dayIdx]}
              </div>
              {row.map((cell) => (
                <div
                  key={`${cell.day}-${cell.hour}`}
                  className="flex-1 aspect-square rounded-[2px] cursor-pointer transition-transform hover:scale-125 hover:z-10"
                  style={{ backgroundColor: getColorIntensity(cell.count, maxCount) }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({ ...cell, x: rect.left + rect.width / 2, y: rect.top - 8 })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}

          {/* Legend */}
          <div className="mt-3 flex items-center justify-end gap-2 pr-[60px]">
            <span className="text-[10px] text-muted-foreground">قليل</span>
            {[0.15, 0.35, 0.6, 0.85].map((opacity, i) => (
              <div
                key={i}
                className="h-3 w-3 rounded-[2px]"
                style={{ backgroundColor: `hsl(var(--primary) / ${opacity})` }}
              />
            ))}
            <span className="text-[10px] text-muted-foreground">كثير</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-background px-2 py-1 text-xs shadow-md"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          {DAY_LABELS[tooltip.day]} {String(tooltip.hour).padStart(2, '0')}:00 — {tooltip.count}{' '}
          نشاط
        </div>
      )}
    </ChartWrapper>
  )
}
