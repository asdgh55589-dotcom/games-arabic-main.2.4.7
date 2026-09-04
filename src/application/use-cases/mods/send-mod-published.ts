/**
 * SendModPublishedNotification — إشعار تعريب جديد
 * Notifies the mod author when their mod is published.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface ModPublishedContext {
  modAuthorId: string
  modId: string
  modTitle: string
  modSlug: string
}

export class SendModPublishedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: ModPublishedContext): Promise<void> {
    await this.notificationService.send({
      userId: context.modAuthorId,
      type: NotificationType.ModPublished,
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
