'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface MonthlyTrend {
  month: string
  count: number
}

export function ReportTrendChart() {
  const [trend, setTrend] = useState<MonthlyTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/reports/stats')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => setTrend(data.monthlyTrend || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card/50 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (trend.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">لا توجد بيانات اتجاهات</p>
      </div>
    )
  }

  const maxCount = Math.max(...trend.map((t) => t.count), 1)

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
        البلاغات الشهرية (آخر 12 شهر)
      </h3>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {trend.map((t) => {
          const heightPct = (t.count / maxCount) * 100
          const label = t.month.slice(5)
          return (
            <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{t.count}</span>
              <div
                className="w-full rounded-t bg-primary/70 transition-all"
                style={{ height: `${Math.max(heightPct, 4)}%`, minHeight: 4 }}
                title={`${t.month}: ${t.count}`}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
