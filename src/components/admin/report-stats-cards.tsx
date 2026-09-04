'use client'

import { Clock, Hash, Loader2, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

interface StatsData {
  total: number
  new: number
  underReview: number
  confirmed: number
  rejected: number
  resolved: number
  confirmationRate: number
  avgResolutionHours: number
}

const CARDS = [
  { key: 'new' as const, label: 'جديدة', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  {
    key: 'underReview' as const,
    label: 'قيد المراجعة',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
  },
  { key: 'confirmed' as const, label: 'مؤكدة', color: 'text-red-500', bg: 'bg-red-500/10' },
  { key: 'rejected' as const, label: 'مرفوضة', color: 'text-gray-500', bg: 'bg-gray-500/10' },
]

export function ReportStatsCards() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/reports/stats')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        const payload = data?.data ?? data
        setStats(payload)
      })
      .catch((err) => {
        console.error('Failed to load report stats:', err)
        setError('فشل تحميل الإحصائيات')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-center rounded-lg border border-border bg-card/50 p-4"
          >
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid place-items-center rounded-lg border border-border bg-card/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {CARDS.map((c) => (
        <div key={c.key} className={`rounded-lg border border-border p-4 ${c.bg}`}>
          <div className={`text-2xl font-bold ${c.color}`}>{stats[c.key] ?? 0}</div>
          <div className="mt-1 text-xs text-muted-foreground">{c.label}</div>
        </div>
      ))}
      <div className="rounded-lg border border-border bg-green-500/10 p-4">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <span className="text-2xl font-bold text-green-500">
            {Math.round((stats.confirmationRate ?? 0) * 100)}%
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">نسبة التأكيد</div>
      </div>
      <div className="rounded-lg border border-border bg-purple-500/10 p-4">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-purple-500" />
          <span className="text-2xl font-bold text-purple-500">
            {(stats.avgResolutionHours ?? 0).toFixed(1)}h
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">متوسط وقت المعالجة</div>
      </div>
      <div className="rounded-lg border border-border bg-orange-500/10 p-4">
        <div className="flex items-center gap-1.5">
          <Hash className="h-4 w-4 text-orange-500" />
          <span className="text-2xl font-bold text-orange-500">{stats.total ?? 0}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">الإجمالي</div>
      </div>
    </div>
  )
}
