/**
 * SendAutoBanNotification — إشعار حظر تلقائي
 * Notifies the target user when they receive an auto-ban from report system.
 */

import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationService } from '../../services'

export interface AutoBanContext {
  targetUserId: string
  reportId: string
  banType: 'temp_ban' | 'perm_ban'
  durationDays?: number
}

export class SendAutoBanNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: AutoBanContext): Promise<void> {
    const title = context.banType === 'temp_ban'
      ? `تعليق مؤقت — ${context.durationDays} أيام`
      : 'حظر دائم'

    await this.notificationService.send({
      userId: context.targetUserId,
      type: NotificationType.AdminAction,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      skipDeduplication: true,
      data: {
        reportId: context.reportId,
        action: context.banType,
        durationDays: context.durationDays,
      },
      templateVariables: {
        action: title,
        banType: context.banType,
        durationDays: context.durationDays,
      },
    })
  }
}
