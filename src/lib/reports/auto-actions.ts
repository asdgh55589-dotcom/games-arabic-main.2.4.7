import { db } from '@/lib/db'
import { getUseCases } from '@/application/use-cases/factory'
import { setTokenVersionCache } from '@/lib/token-version-cache'
import type { ReportAction } from './constants'

interface AutoActionInput {
  reportId: string
  action: ReportAction
  resolution: string
  banDuration?: number
  targetUserId?: string
}

export async function executeAutoAction(input: AutoActionInput & { actorId?: string; actorRole?: string }) {
  const { reportId, action, resolution, banDuration, targetUserId, actorId, actorRole } = input

  // 🔒 شبكة أمان إضافية للحظر الدائم — حتى لو تم استدعاء الدالة مباشرة
  if (action === 'perm_ban' && actorRole && !['manager', 'admin', 'owner'].includes(actorRole)) {
    throw new Error('يجب أن تكون مديراً أو أعلى لتنفيذ الحظر الدائم')
  }
  // إذا تم تمرير actorId بدون role نتحقق من DB
  if (action === 'perm_ban' && actorId && !actorRole) {
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true } })
    if (actor && !['manager', 'admin', 'owner'].includes(actor.role)) {
      throw new Error('يجب أن تكون مديراً أو أعلى لتنفيذ الحظر الدائم')
    }
  }
  // رفض افتراضي إذا لم يتم تمرير أي هوية منفذ للحظر الدائم — أمان إضافي
  if (action === 'perm_ban' && !actorId && !actorRole) {
    throw new Error('يجب أن تكون مديراً أو أعلى لتنفيذ الحظر الدائم — هوية المنفذ مطلوبة')
  }

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

    try {
      const useCases = getUseCases()
      await useCases.sendAutoWarning.execute({
        targetUserId: userId,
        reportId,
        reason: resolution,
      })
    } catch {}
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

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        banStatus: action === 'temp_ban' ? 'banned_temp' : 'banned_perm',
        bannedUntil,
        banReason: resolution,
        bannedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    })
    // إبطال جميع الجلسات عبر كاش Edge لتسجيل خروج فوري بعد الحظر
    try {
      await setTokenVersionCache(userId, updatedUser.tokenVersion)
    } catch {}

    await db.userAction.create({
      data: {
        userId,
        action: action === 'temp_ban' ? 'suspend' : 'ban',
        reason: resolution,
        expiresAt: bannedUntil,
        metadata: JSON.stringify({ reportId }),
      },
    })

    try {
      const useCases = getUseCases()
      await useCases.sendAutoBan.execute({
        targetUserId: userId,
        reportId,
        banType: action === 'temp_ban' ? 'temp_ban' : 'perm_ban',
        durationDays: action === 'temp_ban' ? banDuration || 7 : undefined,
      })
    } catch {}
  }

  await db.report.update({
    where: { id: reportId },
    data: {
      status: 'confirmed' as any,
      actionTaken: action as any,
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
