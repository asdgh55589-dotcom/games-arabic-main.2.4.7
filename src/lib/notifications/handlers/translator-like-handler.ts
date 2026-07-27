// src/lib/notifications/handlers/translator-like-handler.ts
import { db } from '@/lib/db'
import { sendRealtimeNotification } from '../realtime'
import { NotificationType } from '@/lib/notifications/types'

export async function handleTranslatorLike(
  translationId: string,
  likerId: string
) {
  const translation = await db.mod.findUnique({
    where: { id: translationId },
    include: { author: true }
  })

  if (!translation || translation.authorId === likerId) return

  const likeCount = await db.endorsement.count({
    where: { modId: translationId }
  })

  const preferences = await db.notificationPreference.findUnique({
    where: { userId: translation.authorId }
  })

  const threshold = preferences?.likeThreshold || 25

  if (likeCount >= threshold && likeCount % threshold === 0) {
    await db.notification.create({
      data: {
        userId: translation.authorId,
        type: NotificationType.Like,
        title: 'تعريبك حصل على إعجابات كتير! 🎉',
        message: `تعريب "${translation.name}" حصل على ${likeCount} إعجابة!`,
        data: {
          translationId,
          likeCount,
          likerId
        }
      }
    })

    await sendRealtimeNotification(translation.authorId)
  }
}
