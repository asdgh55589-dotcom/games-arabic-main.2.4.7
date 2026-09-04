'use client'

import { Gamepad2 } from 'lucide-react'
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface TopPlatformProps {
  data: { platforms?: { name: string; count: number; percentage: number }[] } | undefined
  loading?: boolean
}

const PLATFORM_ICONS: Record<string, string> = {
  'Nintendo Switch': '🎮',
  PS4: '🎯',
  PS3: '🎯',
  PS2: '🎯',
  PS1: '🎯',
  Xbox: '🟢',
  PC: '💻',
}

export function TopPlatform({ data, loading }: TopPlatformProps) {
  const top = useMemo(() => {
    if (!data?.platforms || data.platforms.length === 0) return null
    return data.platforms[0]
  }, [data])

  if (loading) return <Skeleton className="h-[100px] w-full rounded-lg" />

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">المنصة الأكثر تعريبات</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-lg">{PLATFORM_ICONS[top?.name || ''] || '🎮'}</span>
          <div>
            <span className="text-lg font-bold">{top?.name ?? '—'}</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{top?.count ?? 0} تعريب</span>
              <span>•</span>
              <span>{top?.percentage ?? 0}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
