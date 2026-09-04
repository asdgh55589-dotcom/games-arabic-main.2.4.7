'use client'

import { Progress } from '@/components/ui/progress'
import type { UserRole } from '@/lib/roles'
import { getTierLabel } from '@/lib/tiers'

interface Props {
  role: UserRole
  currentTier: number
  progress: {
    publishedCount: number
    averageRating: number
    reviewsCount: number
    monthsActive?: number
  }
  nextRequirements?: {
    minPublishedCount?: number
    minAverageRating?: number
    minReviewsCount?: number
    minMonthsActive?: number
    requiresAdminApproval?: boolean
  } | null
}

export function TierProgress({ role, currentTier, progress, nextRequirements }: Props) {
  if (!nextRequirements) {
    return <div className="text-sm text-muted-foreground">🏆 وصلت لأعلى مستوى في دورك!</div>
  }

  if (nextRequirements.requiresAdminApproval) {
    const nextLabel = getTierLabel(role, currentTier + 1)
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="text-sm font-medium">التقدم نحو: {nextLabel}</div>
        <div className="text-xs text-muted-foreground mt-1">
          هذا المستوى يتطلب موافقة الإدارة بعد استيفاء الشروط
        </div>
        {nextRequirements.minPublishedCount !== undefined && (
          <div className="text-xs mt-2">
            {progress.publishedCount}/{nextRequirements.minPublishedCount} تعريبات منشورة
          </div>
        )}
      </div>
    )
  }

  const nextLabel = getTierLabel(role, currentTier + 1)
  const items: Array<{ label: string; pct: number }> = []

  if (nextRequirements.minPublishedCount !== undefined) {
    const pct = Math.min(100, (progress.publishedCount / nextRequirements.minPublishedCount) * 100)
    items.push({
      label: `${progress.publishedCount}/${nextRequirements.minPublishedCount} تعريبات منشورة`,
      pct,
    })
  }

  if (nextRequirements.minAverageRating !== undefined) {
    const pct = Math.min(100, (progress.averageRating / nextRequirements.minAverageRating) * 100)
    items.push({
      label: `تقييم ${progress.averageRating.toFixed(1)}/${nextRequirements.minAverageRating}`,
      pct,
    })
  }

  if (nextRequirements.minReviewsCount !== undefined) {
    const pct = Math.min(100, (progress.reviewsCount / nextRequirements.minReviewsCount) * 100)
    items.push({
      label: `${progress.reviewsCount}/${nextRequirements.minReviewsCount} مراجعات`,
      pct,
    })
  }

  if (nextRequirements.minMonthsActive !== undefined) {
    const months = progress.monthsActive || 0
    const pct = Math.min(100, (months / nextRequirements.minMonthsActive) * 100)
    items.push({
      label: `${months}/${nextRequirements.minMonthsActive} أشهر نشاط`,
      pct,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">التقدم نحو: {nextLabel}</span>
      </div>
      {items.map((item, i) => (
        <div key={i}>
          <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
          <Progress value={item.pct} />
        </div>
      ))}
    </div>
  )
}
