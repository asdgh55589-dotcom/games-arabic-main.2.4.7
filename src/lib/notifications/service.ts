/**
 * lib/notifications/service.ts — خدمة الإشعارات متعددة القنوات
 *
 * الكاتب الوحيد للإشعارات (unified writer): ينشئ صف `Notification` +
 * مهمة `NotificationJob` لكل قناة + سجل `NotificationLog` لكل قناة،
 * بعد تطبيق التفضيلات ومنع التكرار. الإرسال الفعلي (بريد/Telegram)
 * يتم لاحقاً في عامل التصريف drain.ts عبر مسار cron — راجعه هناك.
 *
 * تدعم الإشعارات عبر: داخل التطبيق، البريد الإلكتروني، Telegram
 */

import { db } from '../db'
import {
  buildVariables,
  dedupCutoff,
  dedupWindowMinutes,
  isChannelEnabled,
  type NotificationContentSource,
} from './pipeline'
import { renderNotificationContent } from './template-renderer'
import { type NotificationEvent, NotificationType } from './types'

/**
 * ملخص ما تم فعله فعلياً — يُرجع بدلاً من `void` حتى لا يظن المستدعي أن كل
 * المستلمين استلموا الإشعار.
 */
export interface SendNotificationResult {
  /** عدد إشعارات `Notification` التي أُنشئت فعلياً في قاعدة البيانات */
  created: number
  /** عدد المستلمين الذين لم يُنشأ لهم إشعار (لا قناة قابلة للتوصيل) */
  skipped: number
  /** عدد مهام البريد/Telegram المنشأة بانتظار عامل التصريف (cron) */
  queued: number
  /** عدد المستلمين المستبعدين لأن إشعاراً مماثلاً موجود داخل نافذة المنع */
  deduplicated: number
}

interface RecipientRow {
  id: string
  username: string
  displayName: string | null
  telegramUrl: string | null
}

/**
 * إرسال إشعار عبر القنوات المتاحة
 */
export async function sendNotification(event: NotificationEvent): Promise<SendNotificationResult> {
  const now = new Date()
  const recipients = event.recipients

  console.log(`[notification-service] Sending ${event.type} to ${recipients.length} recipients`)

  let created = 0
  let skipped = 0
  let queued = 0
  let deduplicated = 0

  if (recipients.length === 0) return { created, skipped, queued, deduplicated }

  const userIds = recipients.map((r) => r.userId)

  // استعلامان مجمّعان بدل استعلام لكل مستلم (الإرسال الجماعي قد يصل لكل المستخدمين)
  const [preferences, users] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: { in: userIds } } }),
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, telegramUrl: true },
    }),
  ])
  const preferencesByUser = new Map(preferences.map((p) => [p.userId, p]))
  const usersById = new Map<string, RecipientRow>(users.map((u) => [u.id, u]))

  // منع التكرار: استعلام واحد لكل المستلمين داخل النافذة الزمنية
  const windowMinutes = event.skipDeduplication ? 0 : dedupWindowMinutes(event.type)
  const recentByUser = new Map<string, boolean>()
  if (windowMinutes > 0) {
    // استعلام واحد يجمع المستلمين الذين لديهم إشعار مماثل داخل النافذة
    const recent = await db.notification.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        type: event.type,
        createdAt: { gte: dedupCutoff(now, windowMinutes) },
      },
      _count: { _all: true },
    })
    for (const row of recent) recentByUser.set(row.userId, true)
  }

  for (const recipient of recipients) {
    const preferences = preferencesByUser.get(recipient.userId) ?? null

    // القنوات التي لم يعطّلها المستخدم (عام + خاص بالنوع) — نفس فحص
    // domain PreferencePolicy.canDeliver. عامل التصريف يعيد الفحص قبل
    // الإرسال، فالتفضيلات التي تتغير بعد الكتابة ما تزال مُحترمة.
    let channels = recipient.channels.filter((c) => isChannelEnabled(preferences, c, event.type))

    const user = usersById.get(recipient.userId) ?? null

    // Telegram requires telegramUrl — فلترة القناة إذا لم يكن موجوداً
    if (channels.includes('telegram') && !user?.telegramUrl) {
      channels = channels.filter((c) => c !== 'telegram')
    }

    if (channels.length === 0) {
      skipped++
      continue
    }

    // منع التكرار قبل أي كتابة في القاعدة
    if (windowMinutes > 0 && recentByUser.get(recipient.userId)) {
      deduplicated++
      continue
    }

    const recipientInfo = {
      username: user?.username ?? '',
      displayName: user?.displayName ?? null,
    }

    const variables = buildVariables(
      {
        type: event.type,
        title: event.title,
        message: event.message,
        data: event.data,
        targetUrl: event.targetUrl,
        targetTitle: event.targetTitle,
        targetSlug: event.targetSlug,
        actorUsername: event.actorUsername,
      },
      recipientInfo,
    )

    // عرض المحتوى من القالب (in_app) مع fallback
    const content = await renderNotificationContent(event.type, 'in_app', variables, {
      title: event.title,
      message: event.message,
    })

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
    created++

    // إنشاء مهمة + سجل لكل قناة مرتبطة بنفس الإشعار
    for (const channel of channels) {
      if (channel === 'in_app') {
        // داخل التطبيق: التسليم = وجود الصف، لذا تُغلق المهمة والسجل فوراً.
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
            scheduledFor: now,
          },
        })
        // سجل من البداية: عامل التصريف يحدّث هذا الصف بنفسه (logId ثابت
        // يُستخدم كـ requestId/بيكسل في البريد).
        await db.notificationLog.create({
          data: {
            notificationId: notification.id,
            channel,
            status: 'queued',
          },
        })
        queued++
      }
    }
  }

  return { created, skipped, queued, deduplicated }
}

/**
 * ساعات الهدوء لم تعد تقني القناة هنا: مهمة البريد/Telegram تُنشأ ثم يؤجّلها
 * عامل التصريف (drain.ts) حتى تنتهي نافذة الهدوء بمنطقة المستلم الزمنية،
 * فلا يضيع الإشعار ولا يصل أثناء الهدوء.
 */

/** مصدر المحتوى من صف إشعار جاهز — يُستخدم أيضاً من عامل التصريف. */
export function notificationSource(notification: {
  type: string
  title: string
  message: string
  data?: unknown
  targetUrl?: string | null
  targetTitle?: string | null
  targetSlug?: string | null
  actorUsername?: string | null
}): NotificationContentSource {
  return {
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: (notification.data ?? {}) as Record<string, unknown>,
    targetUrl: notification.targetUrl,
    targetTitle: notification.targetTitle,
    targetSlug: notification.targetSlug,
    actorUsername: notification.actorUsername,
  }
}

/**
 * إرسال إشعار workflow تغيير (مستدعى عبر sendNotification أعلاه).
 *
 * محفوظ للتوافق: لا يوجد مستدعٍ له حالياً — مسار `/api/admin/mods/[id]/workflow`
 * يستخدم `lib/mod-notifications.notifyWorkflowChange` (نفس المضمون، كاتب واحد).
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
  const {
    modId,
    modName,
    modSlug,
    fromStatus,
    toStatus,
    actorId,
    reason,
    actorUsername,
    actorAvatarUrl,
  } = params

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
    recipients: [{ userId: mod.authorId, channels: ['in_app', 'email'] }],
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
