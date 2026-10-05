'use client'

import { Activity, AlertTriangle, Loader2, Mail, RotateCcw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * إعادة الإرسال معطّلة: `POST /api/admin/notifications/retry` يحوّل المهمة إلى
 * `pending` ويمسح `attempts`، لكن لا يوجد عامل معالجة يستهلك `pending`
 * (`processNotificationQueue()` بلا مستدعٍ)، فالمهمة تبقى معلّقة للأبد.
 * تُفعّل عند إضافة العامل في P2.
 */
const RETRY_DISABLED_REASON =
  'إعادة الإرسال معطلة مؤقتاً: لا يوجد عامل معالجة يقرأ مهام الإشعارات المعلّقة'

/**
 * حقول الاستجابة المستخدمة هنا فقط.
 *
 * كائن `metrics` في استجابة `/api/admin/notifications-health` محذوف من العرض
 * عمداً: `metricsService.getMetrics()` يعيد أصفاراً ثابتة و
 * `circuitBreakerState: 'CLOSED'` و `averageDeliveryLatencyMs: 0` ثابتة، ولا
 * يوجد أي كود يستدعي العدادات — فكلها كانت تُعرض كأرقام حيّة.
 * الحقول المعروضة أدناه كلها استعلامات حقيقية على قاعدة البيانات.
 */
interface HealthData {
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
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center" dir="rtl">
        <XCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { database } = data
  const failureCount = database.recentFailures.length

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">صحة الإشعارات</h1>
        <p className="mt-2 text-muted-foreground">
          أرقام حقيقية من قاعدة البيانات — مؤشرات الأداء الحيّة غير متاحة بعد
        </p>
      </div>

      {/* Overview Cards — كلها استعلامات حقيقية على قاعدة البيانات */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="إجمالي الإشعارات"
          value={database.totalNotifications.toLocaleString()}
          color="text-blue-400"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="مهام في الحالة الميتة"
          value={database.deadLetterJobs.toLocaleString()}
          color={database.deadLetterJobs > 0 ? 'text-red-400' : 'text-yellow-400'}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label="فشلات معروضة"
          value={failureCount.toLocaleString()}
          color={failureCount > 0 ? 'text-red-400' : 'text-green-400'}
        />
      </div>

      {/* Metrics Table — أرقام حقيقية فقط */}
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
              <MetricRow label="إجمالي الإشعارات" value={database.totalNotifications} />
              <MetricRow label="إشعارات غير مقروءة" value={database.unreadCount} />
              <MetricRow label="المهام الميتة (dead_letter)" value={database.deadLetterJobs} />
              <MetricRow label="فشلات معروضة" value={failureCount} />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          المقاييس التي كانت هنا سابقاً (تم إنشاؤها، تم توصيلها، أُعيدت المحاولة، حالة قاطع الدارة،
          متوسط زمن التوصيل) حُذفت من العرض لأنها قيم ثابتة لا تتغير مع حالة النظام.
        </p>
      </div>

      {/* Recent Failures */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">آخر الفشلات</h2>
        {database.recentFailures.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">لا توجد فشلات حديثة</p>
        ) : (
          <TooltipProvider delayDuration={0}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      المعرف
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      القناة
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      المحاولات
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      الخطأ
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      الوقت
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      الإجراء
                    </th>
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
                        {/* الزر داخل span لأن Radix لا يفعّل التلميح على زر معطّل */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="min-h-[44px] min-w-[44px]"
                                disabled
                                aria-label={RETRY_DISABLED_REASON}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{RETRY_DISABLED_REASON}</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TooltipProvider>
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
