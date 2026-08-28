/**
 * OnNotificationCreatedHandler — معالج حدث إنشاء إشعار
 */

import type { NotificationCreatedEvent } from '@/domain'
import { notificationLogger } from '@/infrastructure/observability/logger'
import { metricsService } from '@/infrastructure/observability/metrics'

export class OnNotificationCreatedHandler {
  async handle(event: NotificationCreatedEvent): Promise<void> {
    metricsService.increment('notifications.created.total')
    notificationLogger.info('Notification created', {
      notificationId: event.notificationId,
      userId: event.userId,
      notificationType: event.type,
      action: 'notification.created',
    })
  }
}
