'use client'

import { AlertTriangle, CheckCircle, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FraudSignal {
  id: string
  signalType: string
  score: number
  description: string
  createdAt: Date | string
}

interface Props {
  fraudScore: number
  signals: FraudSignal[]
}

export function ReportFraudCard({ fraudScore, signals }: Props) {
  const getColor = (score: number) => {
    if (score >= 0.7)
      return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
    if (score >= 0.4)
      return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400'
    return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400'
  }

  const getLabel = (score: number) => {
    if (score >= 0.7) return '⚠️ مشبوه جداً'
    if (score >= 0.4) return '🟡 يحتاج مراجعة'
    return '✅ طبيعي'
  }

  const getIcon = (score: number) => {
    if (score >= 0.7) return <AlertTriangle className="h-5 w-5" />
    if (score >= 0.4) return <Shield className="h-5 w-5" />
    return <CheckCircle className="h-5 w-5" />
  }

  return (
    <Card className={getColor(fraudScore)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {getIcon(fraudScore)}
          درجة الاحتيال: {(fraudScore * 100).toFixed(0)}%
          <Badge variant="outline" className="bg-white/70 dark:bg-black/20">
            {getLabel(fraudScore)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد إشارات احتيال مكتشفة</p>
        ) : (
          <div className="space-y-3">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-start justify-between p-3 bg-white/50 dark:bg-black/20 rounded-lg border"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{signal.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {signal.signalType} — قوة: {(signal.score * 100).toFixed(0)}%
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 mr-3">
                  {(signal.score * 100).toFixed(0)}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
