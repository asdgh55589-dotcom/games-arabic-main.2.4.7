/**
 * SendFollowNotification — إشعار متابعة جديدة
 * Notifies the followed user when someone follows them.
 */

import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationService } from '../../services'

export interface FollowContext {
  followedUserId: string
  followerId: string
  followerName: string
}

export class SendFollowNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: FollowContext): Promise<void> {
    if (context.followedUserId === context.followerId) return

    await this.notificationService.send({
      userId: context.followedUserId,
      type: NotificationType.Follow,
      actorId: context.followerId,
      channels: [NotificationChannel.InApp],
      templateVariables: {
        followerName: context.followerName,
      },
    })
  }
}
