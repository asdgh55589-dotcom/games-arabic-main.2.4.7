/**
 * SendModDeletedNotification — إشعار حذف تعريب
 * Notifies the mod author when their mod is deleted.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface ModDeletedContext {
  modAuthorId: string
  modTitle: string
  deletedBy: string
  reason?: string
}

export class SendModDeletedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: ModDeletedContext): Promise<void> {
    await this.notificationService.send({
      userId: context.modAuthorId,
      type: NotificationType.ModDeleted,
      actorId: context.deletedBy,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      skipDeduplication: true,
      data: {
        modTitle: context.modTitle,
      },
      templateVariables: {
        modTitle: context.modTitle,
        reason: context.reason,
      },
    })
  }
}
