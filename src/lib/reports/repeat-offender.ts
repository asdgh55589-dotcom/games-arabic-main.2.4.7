import { getUseCases } from '@/application/use-cases/factory'
import { db } from '@/lib/db'
import { setTokenVersionCache } from '@/lib/token-version-cache'

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

  // 🛡️ حماية المدراء والمالكين من الحظر التلقائي — تحقق مبكر يمنع أي escalate لمستخدم مميز
  if (newLevel >= 2) {
    try {
      const privileged = await db.user.findUnique({
        where: { id: targetUserId },
        select: { role: true, username: true },
      })
      if (privileged && ['owner', 'manager', 'admin'].includes(privileged.role)) {
        console.log(
          `[repeat-offender] تم تجاوز الحظر التلقائي للمستخدم المميز ${targetUserId} (الدور: ${privileged.role})`,
        )
        // سجل تجاوز للمراجعة اليدوية بدلاً من الحظر
        await db.auditLog.create({
          data: {
            action: 'moderate',
            entity: 'repeat_offender_skipped',
            entityId: targetUserId,
            details: JSON.stringify({
              reason: 'محاولة حظر تلقائي لمستخدم مميز — يتطلب مراجعة يدوية',
              role: privileged.role,
              username: privileged.username,
              previousLevel: currentLevel,
              newLevel,
              confirmedCount,
            }),
          },
        })
        // إشعار كبار الإدارة إن أمكن — نحاول إرسال تنبيه للمسؤولين
        try {
          const admins = await db.user.findMany({
            where: { role: { in: ['owner', 'manager'] } },
            select: { id: true },
            take: 10,
          })
          if (admins.length > 0) {
            const { getNotificationService } = await import(
              '@/infrastructure/di/notification-container'
            )
            const { NotificationType, NotificationChannel } = await import('@/domain')
            const service = getNotificationService()
            for (const admin of admins) {
              try {
                await service.send({
                  userId: admin.id,
                  type: NotificationType.AdminReport,
                  channels: [NotificationChannel.InApp],
                  skipDeduplication: true,
                  data: { targetUserId, reportCount: confirmedCount, attemptedLevel: newLevel },
                  templateVariables: {
                    targetTitle: privileged.username,
                    reason: 'محاولة حظر تلقائي لمستخدم مميز — يتطلب مراجعة يدوية',
                  },
                })
              } catch {}
            }
          }
        } catch {}
        return
      }
    } catch {}
  }

  // Execute escalation action
  if (newLevel === 1) {
    // Level 1: Send warning notification
    try {
      const useCases = getUseCases()
      await useCases.sendAutoWarning.execute({
        targetUserId,
        reportId: 'repeat_offender',
        reason: 'تكرار بلاغات مؤكدة',
      })
    } catch {}
  }

  if (newLevel === 2) {
    // Level 2: Auto temp ban (7 days) — مع إبطال الجلسات فوراً
    const bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const updatedUserLevel2 = await db.user.update({
      where: { id: targetUserId },
      data: {
        banStatus: 'banned_temp',
        bannedUntil,
        banReason: 'تكرار بلاغات مؤكدة — حظر تلقائي',
        bannedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    })
    try {
      await setTokenVersionCache(targetUserId, updatedUserLevel2.tokenVersion)
    } catch {}

    await db.userAction.create({
      data: {
        userId: targetUserId,
        action: 'suspend',
        reason: 'تكرار بلاغات مؤكدة — حظر تلقائي 7 أيام',
        expiresAt: bannedUntil,
      },
    })

    try {
      const useCases = getUseCases()
      await useCases.sendAutoBan.execute({
        targetUserId,
        reportId: 'repeat_offender',
        banType: 'temp_ban',
        durationDays: 7,
      })
    } catch {}
  }

  if (newLevel === 3) {
    // Level 3: Auto permanent ban — مع إبطال الجلسات فوراً
    const updatedUserLevel3 = await db.user.update({
      where: { id: targetUserId },
      data: {
        banStatus: 'banned_perm',
        banReason: 'تكرار بلاغات مؤكدة — حظر دائم تلقائي',
        bannedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    })
    try {
      await setTokenVersionCache(targetUserId, updatedUserLevel3.tokenVersion)
    } catch {}

    await db.userAction.create({
      data: {
        userId: targetUserId,
        action: 'ban',
        reason: 'تكرار بلاغات مؤكدة — حظر دائم تلقائي',
      },
    })

    try {
      const useCases = getUseCases()
      await useCases.sendAutoBan.execute({
        targetUserId,
        reportId: 'repeat_offender',
        banType: 'perm_ban',
      })
    } catch {}
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
