/**
 * SendNotificationInput — مدخلات إرسال الإشعار
 * DTO for the NotificationService.send() method.
 */

import { NotificationType, NotificationChannel } from '@/domain'

export interface SendNotificationInput {
  /** Recipient user ID */
  userId: string
  /** Notification type */
  type: NotificationType
  /** Optional title — template will provide default */
  title?: string
  /** Optional message — template will provide default */
  message?: string
  /** Who performed the action */
  actorId?: string
  /** Extra context (modId, commentId, etc.) */
  data?: Record<string, unknown>
  /** Delivery channels — default: ['in_app'] */
  channels?: NotificationChannel[]
  /** Variables for template rendering */
  templateVariables?: Record<string, unknown>
  /** Skip deduplication for critical notifications (bans, etc.) */
  skipDeduplication?: boolean
  /** Priority affects delivery order */
  priority?: 'low' | 'normal' | 'high'
}
