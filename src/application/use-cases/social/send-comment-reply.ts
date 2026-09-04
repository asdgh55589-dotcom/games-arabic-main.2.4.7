/**
 * SendCommentReplyNotification — إشعار رد على تعليق
 * Notifies the original commenter when someone replies to their comment.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface CommentReplyContext {
  commentOwnerId: string
  replierId: string
  replierName: string
  modId: string
  modTitle: string
  modSlug: string
  commentId: string
  replyPreview: string
}

export class SendCommentReplyNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: CommentReplyContext): Promise<void> {
    if (context.commentOwnerId === context.replierId) return

    await this.notificationService.send({
      userId: context.commentOwnerId,
      type: NotificationType.CommentReply,
      actorId: context.replierId,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      data: {
        modId: context.modId,
        modSlug: context.modSlug,
        commentId: context.commentId,
      },
      templateVariables: {
        actorName: context.replierName,
        modTitle: context.modTitle,
        replyPreview: context.replyPreview,
        modUrl: `/mod/${context.modSlug}`,
      },
    })
  }
}
