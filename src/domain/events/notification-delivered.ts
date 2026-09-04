/**
 * NotificationDeliveredEvent — يُطلق عند توصيل الإشعار بنجاح
 */

import type { DomainEvent } from './base'
import type { NotificationChannel } from '../value-objects'

export interface NotificationDeliveredEvent extends DomainEvent {
  readonly eventType: 'notification.delivered'
  readonly notificationId: string
  readonly channel: NotificationChannel
  readonly deliveredAt: Date
}

export function createNotificationDeliveredEvent(params: {
  notificationId: string
  channel: NotificationChannel
}): NotificationDeliveredEvent {
  return {
    eventType: 'notification.delivered',
    occurredAt: new Date(),
    notificationId: params.notificationId,
    channel: params.channel,
    deliveredAt: new Date(),
  }
}
