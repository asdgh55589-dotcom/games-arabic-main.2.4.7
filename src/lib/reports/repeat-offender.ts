import { db } from '@/lib/db'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'
import { NotificationType } from '@/lib/notifications/types'

const ESCALATION_THRESHOLDS = [
  { level: 0, min: 0, max: 2, label: 'لا إجراء' },
  { level: 1, min: 3, max: 4, label: 'تنبيه أدنى' },
  { level: 2, min: 5, max: 7, label: 'حظر مؤقت 7 أيام' },
  { level: 3, min: 8, max: Infinity, label: 'حظر دائم' },
] as const

export async function updateRepeatOffenseLevel(targetUserId: string): Promise<void> {
  const confirmedCount = await db.report.count({
    where: {
      targetUserId,
      status: 'confirmed',
    },
  })

  // Determine new level
  let newLevel = 0
  for (const threshold of ESCALATION_THRESHOLDS) {
    if (confirmedCount >= threshold.min) {
      newLevel = threshold.level
    }
  }

  // Get current level from most recent report against this user
  const latestReport = await db.report.findFirst({
    where: { targetUserId },
    orderBy: { createdAt: 'desc' },
    select: { repeatOffenseLevel: true },
  })

  const currentLevel = latestReport?.repeatOffenseLevel ?? 0

  // Update all open reports against this user with current level
  await db.report.updateMany({
    where: {
      targetUserId,
      status: { in: ['new', 'under_review'] },
    },
    data: { repeatOffenseLevel: newLevel },
  })

  // Only escalate — never de-escalate automatically
  if (newLevel <= currentLevel) return

  // Execute escalation action
  if (newLevel === 1) {
    // Level 1: Send warning notification
    await db.notification.create({
      data: {
        userId: targetUserId,
        type: NotificationType.AdminAction,
        title: 'تنبيه — تكرار بلاغات',
        message: 'تلقّت حسابك عدة بلاغات مؤكدة. يُرجى مراجعة محتواك.',
      },
    })
    await sendRealtimeNotification(targetUserId)
  }

  if (newLevel === 2) {
    // Level 2: Auto temp ban (7 days)
    const bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.user.update({
      where: { id: targetUserId },
      data: {
        banStatus: 'banned_temp',
        bannedUntil,
        banReason: 'تكرار بلاغات مؤكدة — حظر تلقائي',
        bannedAt: new Date(),
      },
    })

    await db.userAction.create({
      data: {
        userId: targetUserId,
        action: 'suspend',
        reason: 'تكرار بلاغات مؤكدة — حظر تلقائي 7 أيام',
        expiresAt: bannedUntil,
      },
    })

    await db.notification.create({
      data: {
        userId: targetUserId,
        type: NotificationType.AdminAction,
        title: 'تعليق مؤقت — حظر تلقائي',
        message: 'تم تعليق حسابك مؤقتاً لمدة 7 أيام بسبب تكرار بلاغات مؤكدة ضد محتواك.',
      },
    })
    await sendRealtimeNotification(targetUserId)
  }

  if (newLevel === 3) {
    // Level 3: Auto permanent ban
    await db.user.update({
      where: { id: targetUserId },
      data: {
        banStatus: 'banned_perm',
        banReason: 'تكرار بلاغات مؤكدة — حظر دائم تلقائي',
        bannedAt: new Date(),
      },
    })

    await db.userAction.create({
      data: {
        userId: targetUserId,
        action: 'ban',
        reason: 'تكرار بلاغات مؤكدة — حظر دائم تلقائي',
      },
    })

    await db.notification.create({
      data: {
        userId: targetUserId,
        type: NotificationType.AdminAction,
        title: 'حظر دائم — حظر تلقائي',
        message: 'تم حظر حسابك بشكل دائم بسبب تكرار بلاغات مؤكدة ضد محتواك.',
      },
    })
    await sendRealtimeNotification(targetUserId)
  }

  // Audit log
  await db.auditLog.create({
    data: {
      action: 'moderate',
      entity: 'repeat_offender',
      entityId: targetUserId,
      details: JSON.stringify({ previousLevel: currentLevel, newLevel, confirmedCount }),
    },
  })
}
