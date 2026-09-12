import { getUseCases } from '@/application/use-cases/factory'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
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
              } catch (err) {
                // biome-ignore lint/suspicious/noEmptyBlockStatements: per-admin notify is best-effort — one admin's failure must not block the rest or the skip-audit path
                // intentional: expected+handled (loop continues; audit row above already records the skip)
                logger.warn(
                  { event: 'repeat_offender_admin_notify_failed', err },
                  'privileged-skip admin notify failed',
                )
              }
            }
          }
        } catch (err) {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: admin broadcast is advisory — the privileged skip + audit row above already protected the user
          // intentional: expected+handled (escalation stays skipped via the return below)
          logger.warn(
            { event: 'repeat_offender_admin_broadcast_failed', err },
            'privileged-skip admin broadcast failed',
          )
        }
        return
      }
    } catch (err) {
      // UNEXPECTED: the privileged-user guard itself failed (DB/audit down) — fall-through
      // below would escalate a possibly-privileged user, so this needs on-call eyes.
      // Control flow unchanged (fail-open to escalation) — report only.
      logger.error(
        { event: 'repeat_offender_privileged_check_failed', route: 'repeat-offender', err },
        'privileged guard check failed',
      )
      reportError(err, { route: 'reports/repeat-offender', action: 'privileged_guard' })
    }
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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: warning delivery is best-effort — the level is already persisted on open reports above
      // intentional: expected+handled (escalation state committed; notify retries on next report)
      logger.warn(
        { event: 'repeat_offender_warning_failed', err },
        'repeat-offender warning notify failed',
      )
    }
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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Edge token-version cache is advisory — DB tokenVersion is truth, getSession re-checks it
      // intentional: expected+handled (fail-open; logout converges on next DB read)
      logger.warn(
        { event: 'token_version_cache_failed', action: 'repeat_offender_l2', err },
        'token version cache set failed',
      )
    }

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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: ban notify is best-effort — the ban + userAction rows above are already committed
      // intentional: expected+handled (enforcement committed; notify retries on next report)
      logger.warn(
        { event: 'repeat_offender_ban_notify_failed', action: 'temp_ban', err },
        'repeat-offender ban notify failed',
      )
    }
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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Edge token-version cache is advisory — DB tokenVersion is truth, getSession re-checks it
      // intentional: expected+handled (fail-open; logout converges on next DB read)
      logger.warn(
        { event: 'token_version_cache_failed', action: 'repeat_offender_l3', err },
        'token version cache set failed',
      )
    }

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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: ban notify is best-effort — the ban + userAction rows above are already committed
      // intentional: expected+handled (enforcement committed; notify retries on next report)
      logger.warn(
        { event: 'repeat_offender_ban_notify_failed', action: 'perm_ban', err },
        'repeat-offender ban notify failed',
      )
    }
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
