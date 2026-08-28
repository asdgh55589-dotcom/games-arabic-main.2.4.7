'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface MiniGrowthProps {
  data: { modsPublished?: number[]; months?: string[] } | undefined
  loading?: boolean
}

export function MiniGrowth({ data, loading }: MiniGrowthProps) {
  const stats = useMemo(() => {
    if (!data?.modsPublished || data.modsPublished.length < 2) return null
    const recent = data.modsPublished[data.modsPublished.length - 1]
    const prev = data.modsPublished[data.modsPublished.length - 2]
    const change = prev > 0 ? Math.round(((recent - prev) / prev) * 100) : recent > 0 ? 100 : 0
    return { recent, change, isPositive: change >= 0 }
  }, [data])

  if (loading) return <Skeleton className="h-[100px] w-full rounded-lg" />

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">التعريبات هذا الشهر</div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-2xl font-bold">{stats?.recent ?? 0}</span>
          {stats && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${stats.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {stats.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {stats.change > 0 ? '+' : ''}{stats.change}%
            </span>
          )}
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min((stats?.recent ?? 0) / 50 * 100, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
