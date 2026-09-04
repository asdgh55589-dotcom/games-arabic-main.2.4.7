'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface HealthData {
  metrics: {
    created: number
    delivered: number
    failed: number
    retried: number
    deduplicated: number
    preferenceSkipped: number
    queueSize: number
    deadLetterCount: number
    circuitBreakerState: string
    averageDeliveryLatencyMs: number
  }
  database: {
    totalNotifications: number
    unreadCount: number
    deadLetterJobs: number
    recentFailures: Array<{
      id: string
      channel: string
      status: string
      attempts: number
      lastError: string | null
      updatedAt: string
    }>
  }
  timestamp: string
}

export default function NotificationsHealthPage() {
  const { toast } = useToast()
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryId, setRetryId] = useState<string | null>(null)

  const fetchHealth = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/notifications-health')
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error.message || json.error)
        } else {
          setData(json.data)
        }
      })
      .catch(() => setError('Failed to load health data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  const handleRetry = async (jobId: string) => {
    setRetryId(jobId)
    try {
      const res = await fetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: 'تمت إعادة الجدولة' })
        fetchHealth()
      } else {
        toast({ title: json.error || 'فشل إعادة الإرسال', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ في الاتصال', variant: 'destructive' })
    } finally {
      setRetryId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <XCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { metrics, database } = data
  const deliveryRate =
    metrics.created > 0 ? ((metrics.delivered / metrics.created) * 100).toFixed(1) : '0'
  const failureRate =
    metrics.created > 0 ? ((metrics.failed / metrics.created) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">صحة الإشعارات</h1>
        <p className="mt-2 text-muted-foreground">مراقبة حالة نظام الإشعارات والأداء</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="إجمالي الإشعارات"
          value={database.totalNotifications.toLocaleString()}
          color="text-blue-400"
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="نسبة التوصيل"
          value={`${deliveryRate}%`}
          color="text-green-400"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="نسبة الفشل"
          value={`${failureRate}%`}
          color={Number(failureRate) > 5 ? 'text-red-400' : 'text-yellow-400'}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="متوسط زمن التوصيل"
          value={`${metrics.averageDeliveryLatencyMs}ms`}
          color="text-purple-400"
        />
      </div>

      {/* Metrics Table */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">المقاييس</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">المقياس</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">القيمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              <MetricRow label="تم إنشاؤها" value={metrics.created} />
              <MetricRow label="تم توصيلها" value={metrics.delivered} />
              <MetricRow label="فشلت" value={metrics.failed} />
              <MetricRow label="أُعيدت المحاولة" value={metrics.retried} />
              <MetricRow label="تم تجاهلها (تكرار)" value={metrics.deduplicated} />
              <MetricRow label="تم تجاهلها (تفضيلات)" value={metrics.preferenceSkipped} />
              <MetricRow label="الرسائل الميتة" value={database.deadLetterJobs} />
              <MetricRow label="حالة قاطع الدارة" value={metrics.circuitBreakerState} isText />
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Failures */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">آخر الفشلات</h2>
        {database.recentFailures.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">لا توجد فشلات حديثة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">المعرف</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">القناة</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    المحاولات
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الخطأ</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الوقت</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {database.recentFailures.map((failure) => (
                  <tr key={failure.id} className="hover:bg-background-secondary">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {failure.id.substring(0, 12)}...
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-background-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {failure.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{failure.attempts}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-red-400">
                      {failure.lastError}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(failure.updatedAt).toLocaleString('ar')}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 min-h-[44px] min-w-[44px]"
                        onClick={() => handleRetry(failure.id)}
                        disabled={retryId === failure.id}
                        aria-label="إعادة الإرسال"
                      >
                        {retryId === failure.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-10 w-10 place-items-center rounded-lg bg-background-secondary ${color}`}
        >
          {icon}
        </div>
        <div>
          <div className="text-xl font-semibold text-foreground">{value}</div>
          <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  isText,
}: {
  label: string
  value: number | string
  isText?: boolean
}) {
  return (
    <tr className="hover:bg-background-secondary">
      <td className="px-4 py-3 font-medium text-muted-foreground">{label}</td>
      <td
        className={`px-4 py-3 ${isText ? 'font-mono text-sm' : 'text-lg font-semibold'} text-foreground`}
      >
        {isText ? value : (value as number).toLocaleString()}
      </td>
    </tr>
  )
}
