/**
 * SendModUpdatedNotification — إشعار تحديث تعريب
 * Notifies the mod author when their mod is updated.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface ModUpdatedContext {
  modAuthorId: string
  modId: string
  modTitle: string
  modSlug: string
  updatedBy: string
}

export class SendModUpdatedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: ModUpdatedContext): Promise<void> {
    if (context.modAuthorId === context.updatedBy) return

    await this.notificationService.send({
      userId: context.modAuthorId,
      type: NotificationType.ModUpdated,
      actorId: context.updatedBy,
      channels: [NotificationChannel.InApp],
      data: {
        modId: context.modId,
        modSlug: context.modSlug,
      },
      templateVariables: {
        modTitle: context.modTitle,
        modUrl: `/mod/${context.modSlug}`,
      },
    })
  }
}
