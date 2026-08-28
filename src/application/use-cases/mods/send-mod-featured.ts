/**
 * SendModFeaturedNotification — إشعار تعريب مميز
 * Notifies the mod author when their mod is featured.
 */

import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationService } from '../../services'

export interface ModFeaturedContext {
  modAuthorId: string
  modId: string
  modTitle: string
  modSlug: string
}

export class SendModFeaturedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: ModFeaturedContext): Promise<void> {
    await this.notificationService.send({
      userId: context.modAuthorId,
      type: NotificationType.ModFeatured,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
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
