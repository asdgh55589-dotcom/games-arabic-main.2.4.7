/**
 * NotificationCreatedEvent — يُطلق عند إنشاء إشعار جديد
 */

import type { DomainEvent } from './base'
import type { NotificationType, NotificationChannel } from '../value-objects'

export interface NotificationCreatedEvent extends DomainEvent {
  readonly eventType: 'notification.created'
  readonly notificationId: string
  readonly userId: string
  readonly type: NotificationType
  readonly channel: NotificationChannel
  readonly actorId?: string
}

export function createNotificationCreatedEvent(params: {
  notificationId: string
  userId: string
  type: NotificationType
  channel: NotificationChannel
  actorId?: string
}): NotificationCreatedEvent {
  return {
    eventType: 'notification.created',
    occurredAt: new Date(),
    notificationId: params.notificationId,
    userId: params.userId,
    type: params.type,
    channel: params.channel,
    actorId: params.actorId,
  }
}
