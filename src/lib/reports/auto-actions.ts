import { db } from '@/lib/db'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'
import type { ReportAction } from './constants'

interface AutoActionInput {
  reportId: string
  action: ReportAction
  resolution: string
  banDuration?: number
  targetUserId?: string
}

export async function executeAutoAction(input: AutoActionInput) {
  const { reportId, action, resolution, banDuration, targetUserId } = input

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { id: true, targetUserId: true, assignedToId: true, targetModId: true, targetCommentId: true },
  })
  if (!report) return

  const userId = targetUserId || report.targetUserId

  if (action === 'warned' && userId) {
    await db.userAction.create({
      data: {
        userId,
        action: 'warn',
        reason: resolution,
        metadata: JSON.stringify({ reportId }),
      },
    })

    await db.notification.create({
      data: {
        userId,
        type: 'admin_action',
        title: 'تحذير رسمي',
        message: `تم تحذيرك بناءً على بلاغ مقدم ضد محتواك. السبب: ${resolution}`,
      },
    })

    if (userId) await sendRealtimeNotification(userId)
  }

  if (action === 'content_hidden' && report.targetModId) {
    await db.mod.update({
      where: { id: report.targetModId },
      data: { isFeatured: false },
    })
  }

  if (action === 'content_deleted') {
    if (report.targetModId) {
      await db.mod.delete({ where: { id: report.targetModId } })
    } else if (report.targetCommentId) {
      await db.modComment.delete({ where: { id: report.targetCommentId } })
    }
  }

  if ((action === 'temp_ban' || action === 'perm_ban') && userId) {
    const bannedUntil = action === 'temp_ban'
      ? new Date(Date.now() + (banDuration || 7) * 24 * 60 * 60 * 1000)
      : null

    await db.user.update({
      where: { id: userId },
      data: {
        banStatus: action === 'temp_ban' ? 'banned_temp' : 'banned_perm',
        bannedUntil,
        banReason: resolution,
        bannedAt: new Date(),
      },
    })

    await db.userAction.create({
      data: {
        userId,
        action: action === 'temp_ban' ? 'suspend' : 'ban',
        reason: resolution,
        expiresAt: bannedUntil,
        metadata: JSON.stringify({ reportId }),
      },
    })

    await db.notification.create({
      data: {
        userId,
        type: 'admin_action',
        title: action === 'temp_ban' ? 'تعليق مؤقت' : 'حظر دائم',
        message: action === 'temp_ban'
          ? `تم تعليق حسابك مؤقتاً لمدة ${banDuration || 7} أيام.`
          : 'تم حظر حسابك بشكل دائم.',
      },
    })

    if (userId) await sendRealtimeNotification(userId)
  }

  await db.report.update({
    where: { id: reportId },
    data: {
      status: 'confirmed',
      actionTaken: action,
      actionAt: new Date(),
      resolution,
      resolvedAt: new Date(),
    },
  })

  await db.auditLog.create({
    data: {
      action: 'moderate',
      entity: 'report',
      entityId: reportId,
      details: JSON.stringify({ action, resolution }),
    },
  })
}
