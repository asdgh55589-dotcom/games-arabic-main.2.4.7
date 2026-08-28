/**
 * OnNotificationFailedHandler — معالج حدث فشل توصيل إشعار
 */

import type { NotificationFailedEvent } from '@/domain'
import { notificationLogger } from '@/infrastructure/observability/logger'
import { metricsService } from '@/infrastructure/observability/metrics'

export class OnNotificationFailedHandler {
  async handle(event: NotificationFailedEvent): Promise<void> {
    metricsService.increment('notifications.failed.total')
    notificationLogger.error('Notification delivery failed', {
      notificationId: event.notificationId,
      channel: event.channel,
      error: event.error,
      attempt: event.attempt,
      willRetry: event.willRetry,
      action: 'notification.failed',
    })
  }
}
