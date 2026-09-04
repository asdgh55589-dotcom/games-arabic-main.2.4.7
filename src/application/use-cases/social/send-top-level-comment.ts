/**
 * SendTopLevelCommentNotification — إشعار تعليق جديد
 * Notifies the mod author when someone comments on their mod.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface TopLevelCommentContext {
  modAuthorId: string
  commenterId: string
  commenterName: string
  modId: string
  modTitle: string
  modSlug: string
  commentPreview: string
}

export class SendTopLevelCommentNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: TopLevelCommentContext): Promise<void> {
    if (context.modAuthorId === context.commenterId) return

    await this.notificationService.send({
      userId: context.modAuthorId,
      type: NotificationType.TopLevelComment,
      actorId: context.commenterId,
      channels: [NotificationChannel.InApp],
      data: {
        modId: context.modId,
        modSlug: context.modSlug,
      },
      templateVariables: {
        actorName: context.commenterName,
        modTitle: context.modTitle,
        commentPreview: context.commentPreview,
        modUrl: `/mod/${context.modSlug}`,
      },
    })
  }
}
