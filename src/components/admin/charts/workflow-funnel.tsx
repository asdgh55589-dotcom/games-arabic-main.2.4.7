'use client'

import { useMemo, useState } from 'react'
import { ChartWrapper } from './chart-wrapper'

interface FunnelStage {
  name: string
  status: string
  count: number
  conversionRate: number
  avgDays: number
}

interface WorkflowFunnelProps {
  stages: FunnelStage[] | undefined
  loading?: boolean
  error?: string
  onStageClick?: (status: string) => void
}

const STAGE_COLORS = [
  'hsl(210, 16%, 55%)', // draft - gray
  'hsl(47, 100%, 50%)', // in review - yellow
  'hsl(142, 76%, 36%)', // approved - green
  'hsl(var(--primary))', // published - primary
  'hsl(210, 16%, 40%)', // archived - dark gray
]

export function WorkflowFunnel({ stages, loading, error, onStageClick }: WorkflowFunnelProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const maxCount = useMemo(() => {
    if (!stages || stages.length === 0) return 1
    return Math.max(...stages.map((s) => s.count))
  }, [stages])

  if (!stages || stages.length === 0) {
    return (
      <ChartWrapper title="قمعية العمل" loading={loading} error={error}>
        <div />
      </ChartWrapper>
    )
  }

  return (
    <ChartWrapper
      title="قمعية العمل"
      subtitle="مسار التعريب من المسودة للنشر"
      loading={loading}
      error={error}
    >
      <div className="flex flex-col items-center gap-1 py-4">
        {stages.map((stage, idx) => {
          const widthPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
          const isHovered = hoveredIdx === idx

          return (
            <div key={stage.status} className="w-full">
              {/* Trapezoid shape */}
              <div className="flex justify-center">
                <div
                  className="relative cursor-pointer transition-all duration-200"
                  style={{
                    width: `${Math.max(widthPercent, 15)}%`,
                    height: 44,
                    clipPath:
                      idx === stages.length - 1
                        ? 'polygon(5% 0%, 95% 0%, 100% 100%, 0% 100%)'
                        : 'polygon(0% 0%, 100% 0%, 95% 100%, 5% 100%)',
                    backgroundColor: STAGE_COLORS[idx % STAGE_COLORS.length],
                    opacity: isHovered ? 1 : 0.85,
                    transform: isHovered ? 'scaleY(1.1)' : 'scaleY(1)',
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onStageClick?.(stage.status)}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold">
                    {stage.name} — {stage.count}
                  </div>
                </div>
              </div>

              {/* Conversion rate between stages */}
              {idx < stages.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {stages[idx + 1].conversionRate}% تحويل
                  </span>
                </div>
              )}

              {/* Hover tooltip */}
              {isHovered && stage.avgDays > 0 && (
                <div className="flex justify-center">
                  <span className="text-[10px] text-muted-foreground">
                    متوسط الوقت: {stage.avgDays} يوم
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ChartWrapper>
  )
}
