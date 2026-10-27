import { db } from '@/lib/db'
import { syncGameCounts } from '@/lib/game-helpers'
import { logger } from '@/lib/logger'
import { setTokenVersionCache } from '@/lib/token-version-cache'
import type { ReportAction } from './constants'
import { snapshotReportTarget, type ReportTargetSnapshot } from './snapshot'

interface AutoActionInput {
  reportId: string
  action: ReportAction
  resolution: string
  banDuration?: number
  targetUserId?: string
}

export async function executeAutoAction(
  input: AutoActionInput & { actorId?: string; actorRole?: string },
) {
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
    select: {
      id: true,
      targetUserId: true,
      assignedToId: true,
      targetModId: true,
      targetCommentId: true,
    },
  })
  if (!report) return { applied: false }

  const userId = targetUserId || report.targetUserId

  // Claim the report BEFORE side effects for non-delete actions. This makes
  // concurrent confirms/retries lose cleanly instead of double-warning,
  // double-banning or incrementing tokenVersion twice.
  if (action !== 'content_deleted') {
    const claimed = await db.report.updateMany({
      where: {
        id: reportId,
        status: { notIn: ['confirmed', 'rejected', 'resolved'] },
      },
      data: {
        status: 'confirmed' as any,
        actionTaken: action as any,
        actionAt: new Date(),
        resolution,
        resolvedAt: new Date(),
      },
    })
    if (claimed.count === 0) return { applied: false }
  }

  if (action === 'warned' && userId) {
    await db.userAction.create({
      data: {
        userId,
        action: 'warn',
        reason: resolution,
        metadata: JSON.stringify({ reportId }),
      },
    })

    // Consolidated: the detailed confirmed notification is sent by the
    // confirm route (sendReportConfirmed), so no separate auto-warning
    // notification is emitted here to avoid duplicate/lost target notices.
  }

  if (action === 'content_hidden' && report.targetModId) {
    await db.mod.update({
      where: { id: report.targetModId },
      data: { isFeatured: false },
    })
  }

  if (action === 'content_deleted') {
    // Snapshot + conditional resolution + target delete are one transaction:
    // concurrent confirms cannot double-delete or overwrite a good snapshot.
    let applied = false
    let gameId: string | undefined

    await db.$transaction(async (tx) => {
      const current = await tx.report.findUnique({
        where: { id: reportId },
        select: {
          status: true,
          targetModId: true,
          targetCommentId: true,
          snapshot: true,
        },
      })
      if (!current) return
      if (current.status === 'confirmed' || current.status === 'resolved') return

      // Preserve an existing snapshot (e.g. captured by a concurrent attempt).
      const snapshot =
        (current.snapshot as ReportTargetSnapshot | null) ??
        (await snapshotReportTarget(current, tx))
      if (snapshot.type === 'mod') gameId = snapshot.data.gameId

      const updated = await tx.report.updateMany({
        where: {
          id: reportId,
          status: { notIn: ['confirmed', 'rejected', 'resolved'] },
        },
        data: {
          status: 'confirmed' as any,
          actionTaken: action as any,
          actionAt: new Date(),
          resolution,
          resolvedAt: new Date(),
          snapshot: snapshot as any,
        },
      })
      if (updated.count === 0) return

      // deleteMany is idempotent (no P2025 if a concurrent request won).
      if (snapshot.type === 'mod' && current.targetModId) {
        await tx.mod.deleteMany({ where: { id: current.targetModId } })
      } else if (snapshot.type === 'comment' && current.targetCommentId) {
        await tx.modComment.deleteMany({ where: { id: current.targetCommentId } })
      }
      applied = true
    })

    if (!applied) return { applied: false }

    if (gameId) {
      // الحذف التلقائي يزيح العدّادات — تُعاد مزامنتها بعد commit (best-effort).
      syncGameCounts(gameId).catch(() => undefined)
    }

    try {
      await db.auditLog.create({
        data: {
          action: 'moderate',
          entity: 'report',
          entityId: reportId,
          details: JSON.stringify({ action, resolution }),
        },
      })
    } catch (err) {
      logger.warn({ event: 'report_auto_action_audit_failed', action, err }, 'audit failed')
    }
    return { applied: true }
  }

  if ((action === 'temp_ban' || action === 'perm_ban') && userId) {
    const bannedUntil =
      action === 'temp_ban' ? new Date(Date.now() + (banDuration || 7) * 24 * 60 * 60 * 1000) : null

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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Edge token-version cache is advisory — DB tokenVersion is truth, getSession re-checks it
      // intentional: expected+handled (fail-open; logout converges on next DB read)
      logger.warn(
        { event: 'token_version_cache_failed', action: 'auto_action_ban', err },
        'token version cache set failed',
      )
    }

    await db.userAction.create({
      data: {
        userId,
        action: action === 'temp_ban' ? 'suspend' : 'ban',
        reason: resolution,
        expiresAt: bannedUntil,
        metadata: JSON.stringify({ reportId }),
      },
    })

    // Consolidated: the detailed confirmed notification is sent by the
    // confirm route (sendReportConfirmed), so no separate auto-ban
    // notification is emitted here to avoid duplicate/lost target notices.
  }

  try {
    await db.auditLog.create({
      data: {
        action: 'moderate',
        entity: 'report',
        entityId: reportId,
        details: JSON.stringify({ action, resolution }),
      },
    })
  } catch (err) {
    logger.warn({ event: 'report_auto_action_audit_failed', action, err }, 'audit failed')
  }

  return { applied: true }
}
