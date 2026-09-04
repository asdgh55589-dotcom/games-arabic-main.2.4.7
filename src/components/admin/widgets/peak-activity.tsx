'use client'

import { Clock } from 'lucide-react'
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PeakActivityProps {
  data: { data?: { day: number; hour: number; count: number }[]; maxCount?: number } | undefined
  loading?: boolean
}

const DAY_LABELS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function formatHour(hour: number): string {
  if (hour === 0) return '12 صباحاً'
  if (hour === 12) return '12 ظهراً'
  if (hour < 12) return `${hour} صباحاً`
  return `${hour - 12} مساءً`
}

export function PeakActivity({ data, loading }: PeakActivityProps) {
  const peak = useMemo(() => {
    if (!data?.data || data.data.length === 0) return null
    return data.data.reduce((max, cell) => (cell.count > max.count ? cell : max), data.data[0])
  }, [data])

  if (loading) return <Skeleton className="h-[100px] w-full rounded-lg" />

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">ذروة النشاط</div>
        <div className="mt-1 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <span className="text-sm font-bold">
              {peak ? `${DAY_LABELS[peak.day]} ${formatHour(peak.hour)}` : '—'}
            </span>
            <div className="text-xs text-muted-foreground">{peak ? `${peak.count} نشاط` : ''}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
