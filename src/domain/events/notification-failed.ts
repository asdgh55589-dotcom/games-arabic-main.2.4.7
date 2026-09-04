/**
 * NotificationFailedEvent — يُطلق عند فشل توصيل الإشعار
 */

import type { NotificationChannel } from '../value-objects'
import type { DomainEvent } from './base'

export interface NotificationFailedEvent extends DomainEvent {
  readonly eventType: 'notification.failed'
  readonly notificationId: string
  readonly channel: NotificationChannel
  readonly error: string
  readonly attempt: number
  readonly willRetry: boolean
}

export function createNotificationFailedEvent(params: {
  notificationId: string
  channel: NotificationChannel
  error: string
  attempt: number
  willRetry: boolean
}): NotificationFailedEvent {
  return {
    eventType: 'notification.failed',
    occurredAt: new Date(),
    notificationId: params.notificationId,
    channel: params.channel,
    error: params.error,
    attempt: params.attempt,
    willRetry: params.willRetry,
  }
}
