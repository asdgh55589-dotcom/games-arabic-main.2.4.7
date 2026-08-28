/**
 * SendLikeNotification — إشعار إعجاب
 * Notifies the mod author when someone likes their mod.
 */

import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationService } from '../../services'

export interface LikeContext {
  modAuthorId: string
  likerId: string
  likerName: string
  modId: string
  modTitle: string
  modSlug: string
  totalLikes: number
}

export class SendLikeNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: LikeContext): Promise<void> {
    if (context.modAuthorId === context.likerId) return

    await this.notificationService.send({
      userId: context.modAuthorId,
      type: NotificationType.Like,
      actorId: context.likerId,
      channels: [NotificationChannel.InApp],
      data: {
        modId: context.modId,
        modSlug: context.modSlug,
        totalLikes: context.totalLikes,
      },
      templateVariables: {
        actorName: context.likerName,
        modTitle: context.modTitle,
        totalLikes: context.totalLikes,
        modUrl: `/mod/${context.modSlug}`,
      },
    })
  }
}
