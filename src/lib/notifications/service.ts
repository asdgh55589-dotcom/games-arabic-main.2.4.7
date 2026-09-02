/**
 * lib/notifications/service.ts — خدمة الإشعارات متعددة القنوات
 *
 * تدعم الإشعارات عبر: داخل التطبيق، البريد الإلكتروني، Telegram
 */

import { db } from '../db'
import { sendToChannel } from '../telegram-bot'
import { NotificationType, type NotificationChannel, type NotificationEvent } from './types'
import { renderNotificationContent } from './template-renderer'

/**
 * إرسال إشعار عبر القنوات المتاحة
 */
export async function sendNotification(event: NotificationEvent): Promise<void> {
  console.log(`[notification-service] Sending ${event.type} to ${event.recipients.length} recipients`)

  for (const recipient of event.recipients) {
    // Check user preferences
    const preferences = await db.notificationPreference.findUnique({
      where: { userId: recipient.userId },
    })

    // Determine which channels to use
    let channels = determineChannels(recipient.channels, preferences, event.type)

    // Telegram requires telegramUrl — فلترة القناة إذا لم يكن موجوداً
    if (channels.includes('telegram')) {
      const user = await db.user.findUnique({
        where: { id: recipient.userId },
        select: { telegramUrl: true },
      })
      if (!user?.telegramUrl) {
        channels = channels.filter((c) => c !== 'telegram')
      }
    }

    if (channels.length === 0) continue

    // بناء متغيرات القالب
    const variables: Record<string, unknown> = {
      actorName: (event as unknown as Record<string, unknown>).actorName || '',
      recipientName: (recipient as unknown as Record<string, unknown>).displayName || (recipient as unknown as Record<string, unknown>).username || '',
      modName: (event.data as Record<string, unknown> | undefined)?.modName || '',
      teamName: (event.data as Record<string, unknown> | undefined)?.teamName || '',
      ...(event.data || {}),
    }

    // عرض المحتوى من القالب مع fallback
    const content = await renderNotificationContent(
      event.type,
      'in_app',
      variables,
      { title: event.title, message: event.message }
    )

    // إنشاء إشعار واحد مشترك لكل القنوات بمحتوى مُصيّر
    const notification = await db.notification.create({
      data: {
        userId: recipient.userId,
        actorId: event.actorId,
        type: event.type,
        title: content.title,
        message: content.message,
        data: event.data || {},
        targetType: event.targetType || null,
        targetId: event.targetId || null,
        targetSlug: event.targetSlug || null,
        targetTitle: event.targetTitle || null,
        targetUrl: event.targetUrl || null,
        actorUsername: event.actorUsername || null,
        actorAvatarUrl: event.actorAvatarUrl || null,
      },
    })

    // إنشاء مهمة لكل قناة مرتبطة بنفس الإشعار
    for (const channel of channels) {
      if (channel === 'in_app') {
        await db.notificationJob.create({
          data: {
            notificationId: notification.id,
            channel: 'in_app',
            status: 'sent',
            processedAt: new Date(),
          },
        })
        await db.notificationLog.create({
          data: {
            notificationId: notification.id,
            channel: 'in_app',
            status: 'sent',
            sentAt: new Date(),
          },
        })
      } else {
        await db.notificationJob.create({
          data: {
            notificationId: notification.id,
            channel,
            status: 'pending',
          },
        })
      }
    }
  }
}

/**
 * إنشاء إشعار داخل التطبيق — مُهمل: استخدم sendNotification (ينشئ إشعار واحد)
 * محفوظ للتوافق الخلفي فقط
 */
async function createInAppNotification(
  event: NotificationEvent,
  userId: string
): Promise<void> {
  console.warn('[deprecated] createInAppNotification استخدم sendNotification')
}

/**
 * إضافة إشعار بريد إلى قائمة الانتظار — مُهمل
 */
async function queueEmailNotification(
  event: NotificationEvent,
  userId: string
): Promise<void> {
  console.warn('[deprecated] queueEmailNotification استخدم sendNotification')
}

/**
 * إضافة إشعار Telegram إلى قائمة الانتظار — مُهمل
 */
async function queueTelegramNotification(
  event: NotificationEvent,
  userId: string
): Promise<void> {
  console.warn('[deprecated] queueTelegramNotification استخدم sendNotification')
}

/**
 * معالجة قائمة انتظار الإشعارات
 */
export async function processNotificationQueue(): Promise<void> {
  const pendingJobs = await db.notificationJob.findMany({
    where: {
      status: 'pending',
      channel: { in: ['email', 'telegram'] },
    },
    include: {
      notification: {
        include: { user: { select: { id: true, username: true, telegramUrl: true } } },
      },
    },
    take: 20,
  })

  for (const job of pendingJobs) {
    try {
      await db.notificationJob.update({
        where: { id: job.id },
        data: { status: 'processing' },
      })

      if (job.channel === 'telegram') {
        await processTelegramJob(job)
      } else if (job.channel === 'email') {
        await processEmailJob(job)
      }

      await db.notificationJob.update({
        where: { id: job.id },
        data: { status: 'sent', processedAt: new Date() },
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const newAttempts = job.attempts + 1
      await db.notificationJob.update({
        where: { id: job.id },
        data: {
          status: newAttempts >= job.maxAttempts ? 'dead_letter' : 'pending',
          attempts: newAttempts,
          lastError: errorMsg,
        },
      })
    }
  }
}

/**
 * معالجة إشعار Telegram
 */
async function processTelegramJob(job: any): Promise<void> {
  const user = job.notification.user
  if (!user?.telegramUrl) return

  // Extract Telegram username from URL
  const match = user.telegramUrl.match(/t\.me\/(\w+)/)
  if (!match) return

  const message = `🔔 ${job.notification.title}\n\n${job.notification.message}`
  await sendToChannel(message)
}

/**
 * معالجة إشعار بريد
 */
async function processEmailJob(job: any): Promise<void> {
  // Email processing is handled by the existing email-service.ts
  console.log(`[notification-service] Email job ${job.id} queued for email service`)
}

/**
 * تحديد القنوات بناءً على تفضيلات المستخدم
 */
function determineChannels(
  requestedChannels: NotificationChannel[],
  preferences: any,
  eventType: NotificationType
): NotificationChannel[] {
  if (!preferences) return requestedChannels

  // Check quiet hours
  if (preferences.quietHoursEnabled) {
    const now = new Date()
    const hour = now.getHours()
    const start = parseInt(preferences.quietHoursStart || '22', 10)
    const end = parseInt(preferences.quietHoursEnd || '8', 10)

    if (start > end) {
      // Overnight quiet hours
      if (hour >= start || hour < end) {
        return requestedChannels.filter((c) => c === 'in_app')
      }
    } else {
      if (hour >= start && hour < end) {
        return requestedChannels.filter((c) => c === 'in_app')
      }
    }
  }

  // Check type-specific preferences
  const typePrefs = (preferences.typePreferences as Record<string, any>) || {}
  const eventPrefs = typePrefs[eventType]

  if (eventPrefs) {
    return requestedChannels.filter((c) => eventPrefs[c] !== false)
  }

  return requestedChannels
}

/**
 * إرسال إشعار workflow değişikliği
 */
export async function notifyWorkflowChange(params: {
  modId: string
  modName: string
  modSlug?: string
  fromStatus: string
  toStatus: string
  actorId: string
  reason?: string
  actorUsername?: string
  actorAvatarUrl?: string
}): Promise<void> {
  const { modId, modName, modSlug, fromStatus, toStatus, actorId, reason, actorUsername, actorAvatarUrl } = params

  // Get mod author
  const mod = await db.mod.findUnique({
    where: { id: modId },
    select: { authorId: true, slug: true, name: true, teamRelation: { select: { name: true } } },
  })

  if (!mod) return

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'مسودة',
    IN_REVIEW: 'قيد المراجعة',
    APPROVED: 'معتمد',
    PUBLISHED: 'منشور',
    ARCHIVED: 'مؤرشف',
    REJECTED: 'مرفوض',
  }

  const typeMap: Record<string, NotificationType> = {
    IN_REVIEW: NotificationType.ModSubmitted,
    APPROVED: NotificationType.ModApproved,
    REJECTED: NotificationType.ModRejected,
    PUBLISHED: NotificationType.ModPublished,
  }

  const slug = modSlug || mod.slug
  const targetUrl = slug ? `/mod/${slug}` : undefined

  await sendNotification({
    type: typeMap[toStatus] || NotificationType.AdminAction,
    title: `تحديث حالة: ${modName}`,
    message: `تم تغيير حالة التعريب من "${STATUS_LABELS[fromStatus]}" إلى "${STATUS_LABELS[toStatus]}"${reason ? `\nالسبب: ${reason}` : ''}`,
    data: { modId, modName, fromStatus, toStatus, modSlug: slug },
    recipients: [
      { userId: mod.authorId, channels: ['in_app', 'email'] },
    ],
    actorId,
    actorUsername,
    actorAvatarUrl,
    targetType: 'mod',
    targetId: modId,
    targetSlug: slug,
    targetTitle: modName,
    targetUrl,
  })
}
