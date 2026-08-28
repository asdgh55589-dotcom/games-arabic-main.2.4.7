/**
 * OnNotificationDeliveredHandler — معالج حدث توصيل إشعار
 */

import type { NotificationDeliveredEvent } from '@/domain'
import { notificationLogger } from '@/infrastructure/observability/logger'
import { metricsService } from '@/infrastructure/observability/metrics'

export class OnNotificationDeliveredHandler {
  async handle(event: NotificationDeliveredEvent): Promise<void> {
    metricsService.increment('notifications.delivered.total')
    notificationLogger.info('Notification delivered', {
      notificationId: event.notificationId,
      channel: event.channel,
      action: 'notification.delivered',
    })
  }
}
