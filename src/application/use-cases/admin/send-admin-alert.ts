/**
 * SendAdminAlertNotification — إشعار تنبيه إداري
 * Sends alerts to admin users.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface AdminAlertContext {
  adminUserIds: string[]
  title: string
  message: string
  data?: Record<string, unknown>
}

export class SendAdminAlertNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: AdminAlertContext): Promise<void> {
    for (const adminId of context.adminUserIds) {
      await this.notificationService.send({
        userId: adminId,
        type: NotificationType.AdminAction,
        channels: [NotificationChannel.InApp],
        skipDeduplication: true,
        title: context.title,
        message: context.message,
        data: context.data,
      })
    }
  }
}
