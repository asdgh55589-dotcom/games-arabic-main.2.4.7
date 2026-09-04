import { PrismaClient } from '@prisma/client'
import { metricsService } from '@/infrastructure/observability/metrics'
import { internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'

const db = new PrismaClient()

export async function GET() {
  try {
    await requireManager()

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
    console.error('[admin/notifications-health] failed:', err)
    return internalError('Failed to load notification health data')
  }
}
