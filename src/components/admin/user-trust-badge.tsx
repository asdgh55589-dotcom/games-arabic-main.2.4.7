'use client'

import { Badge } from '@/components/ui/badge'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'

interface TrustScore {
  score: number
  totalReports: number
  confirmedReports: number
  rejectedReports: number
  reportAccuracy?: number
}

interface Props {
  score: TrustScore | null | undefined
  label?: string
  showDetails?: boolean
}

export function UserTrustBadge({ score, label = 'الثقة', showDetails = true }: Props) {
  if (!score) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Shield className="h-3 w-3" />
        {label}: غير متاحة
      </Badge>
    )
  }

  const getColor = () => {
    if (score.score >= 70) return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
    if (score.score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700'
    return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
  }

  const getIcon = () => {
    if (score.score >= 70) return <ShieldCheck className="h-3 w-3" />
    if (score.score >= 40) return <Shield className="h-3 w-3" />
    return <ShieldAlert className="h-3 w-3" />
  }

  const getLabel = () => {
    if (score.score >= 70) return 'موثوق'
    if (score.score >= 40) return 'متوسط'
    return '⚠️ مُشكوك'
  }

  const accuracy =
    score.totalReports > 0 ? ((score.confirmedReports / score.totalReports) * 100).toFixed(0) : '0'

  return (
    <div className="space-y-2">
      <Badge variant="outline" className={`${getColor()} gap-1 font-medium`}>
        {getIcon()}
        {label}: {score.score}/100 ({getLabel()})
      </Badge>

      {showDetails && score.totalReports > 0 && (
        <div className="text-xs text-muted-foreground space-y-1 pr-2 border-r-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-medium">✓ {score.confirmedReports}</span>
            <span>مؤكد</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-600 font-medium">✗ {score.rejectedReports}</span>
            <span>مرفوض</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{score.totalReports}</span>
            <span>إجمالي</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
            <span className="font-bold">{accuracy}%</span>
            <span>دقة البلاغات</span>
          </div>
        </div>
      )}
    </div>
  )
}
