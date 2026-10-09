import { metricsService } from '@/infrastructure/observability/metrics'
import { forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    await requireManager()

    // `metricsService.getMetrics()` يُرجع أصفاراً ثابتة و `circuitBreakerState: 'CLOSED'`
    // و `averageDeliveryLatencyMs: 0` لأن لا شيء يستدعي العدادات في أي مسار.
    // نتركه في الاستجابة حفاظاً على توافق أي مستهلك قائم، لكن الواجهة لم تعد تعرضه (P1).
    const metrics = metricsService.getMetrics()

    const [totalNotifications, unreadCount, deadLetterJobs, recentFailures] = await Promise.all([
      db.notification.count(),
      db.notification.count({ where: { isRead: false } }),
      db.notificationJob.count({ where: { status: 'dead_letter' } }),
      db.notificationJob.findMany({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ])

    return ok({
      metrics,
      database: {
        totalNotifications,
        unreadCount,
        deadLetterJobs,
        recentFailures,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — هذه الصفحة للمديرين فقط')
    logger.error('[admin/notifications-health] failed:', err)
    return internalError('Failed to load notification health data')
  }
}
