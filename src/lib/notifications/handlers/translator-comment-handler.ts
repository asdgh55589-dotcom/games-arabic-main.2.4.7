import { db } from '@/lib/db'
import { sendRealtimeNotification } from '../realtime'

export async function handleTranslatorComment(
  translationId: string,
  commentId: string,
  commenterId: string
) {
  const translation = await db.mod.findUnique({
    where: { id: translationId },
    include: { author: true }
  })

  if (!translation || translation.authorId === commenterId) return

  await db.notification.create({
    data: {
      userId: translation.authorId,
      type: 'comment',
      title: 'تعليق جديد على تعريبك',
      message: `أضاف تعليقاً على تعريب "${translation.name}"`,
      data: {
        translationId,
        commentId,
        commenterId
      }
    }
  })

  await sendRealtimeNotification(translation.authorId)
}
