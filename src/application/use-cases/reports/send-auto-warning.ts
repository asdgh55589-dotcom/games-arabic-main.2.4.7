/**
 * SendAutoWarningNotification — إشعار تحذير تلقائي
 * Notifies the target user when they receive an auto-warning from report system.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface AutoWarningContext {
  targetUserId: string
  reportId: string
  reason: string
  resolution?: string
}

export class SendAutoWarningNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: AutoWarningContext): Promise<void> {
    await this.notificationService.send({
      userId: context.targetUserId,
      type: NotificationType.AdminAction,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      skipDeduplication: true,
      data: {
        reportId: context.reportId,
        action: 'warned',
      },
      templateVariables: {
        action: 'تحذير رسمي',
        reason: context.reason,
        resolution: context.resolution,
      },
    })
  }
}
