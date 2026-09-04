'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface WorkflowBottleneckProps {
  data: { stages?: { name: string; count: number; avgDays: number; status: string }[] } | undefined
  loading?: boolean
}

export function WorkflowBottleneck({ data, loading }: WorkflowBottleneckProps) {
  const bottleneck = useMemo(() => {
    if (!data?.stages || data.stages.length === 0) return null
    // Find stage with longest avg time (excluding published/archived)
    const activeStages = data.stages.filter(
      (s) => s.status !== 'PUBLISHED' && s.status !== 'ARCHIVED' && s.count > 0,
    )
    if (activeStages.length === 0) return null
    return activeStages.reduce((max, s) => (s.avgDays > max.avgDays ? s : max), activeStages[0])
  }, [data])

  if (loading) return <Skeleton className="h-[100px] w-full rounded-lg" />

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">عقدة في سير العمل</div>
        <div className="mt-1 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <div>
            <span className="text-sm font-bold">{bottleneck?.name ?? '—'}</span>
            <div className="text-xs text-muted-foreground">
              {bottleneck
                ? `${bottleneck.count} في الانتظار • متوسط ${bottleneck.avgDays} يوم`
                : 'لا توجد عقد'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
