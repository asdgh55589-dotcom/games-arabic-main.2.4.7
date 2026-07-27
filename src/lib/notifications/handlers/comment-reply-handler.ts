import { db } from '@/lib/db'
import { sendRealtimeNotification } from '../realtime'
import { NotificationType } from '@/lib/notifications/types'

export async function handleCommentReply(
  commentId: string,
  replyId: string,
  replierId: string
) {
  const comment = await db.modComment.findUnique({
    where: { id: commentId },
    include: { user: true }
  })

  if (!comment || !comment.userId || comment.userId === replierId) return

  await db.notification.create({
    data: {
      userId: comment.userId,
      type: NotificationType.CommentReply,
      title: 'رد على تعليقك',
      message: `رد على تعليقك "${comment.text.substring(0, 50)}..."`,
      data: {
        commentId,
        replyId,
        replierId
      }
    }
  })

  await sendRealtimeNotification(comment.userId)
}
