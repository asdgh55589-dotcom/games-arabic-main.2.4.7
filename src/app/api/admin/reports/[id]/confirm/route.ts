import type { NextRequest } from 'next/server'
import { getUseCases } from '@/application/use-cases/factory'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { executeAutoAction } from '@/lib/reports/auto-actions'
import { REPORT_ACTIONS, type ReportAction } from '@/lib/reports/constants'
import { updateRepeatOffenseLevel } from '@/lib/reports/repeat-offender'
import { recalculateTrustScore } from '@/lib/reports/trust-score'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const moderator = await requireModerator()
    const { id } = await params
    const body = await req.json()
    const { action, resolution, banDuration } = body

    if (!action || !(action in REPORT_ACTIONS)) {
      return validationFail({ action: 'إجراء غير صالح' })
    }

    // 🔒 الحظر الدائم مقيّد بالمدير+ فقط — المشرف العادي لا يملك صلاحيته
    if (action === 'perm_ban') {
      const allowedRoles = ['manager', 'admin', 'owner']
      if (!allowedRoles.includes(moderator.role)) {
        return forbidden('يجب أن تكون مديراً أو أعلى لتنفيذ الحظر الدائم')
      }
    }

    const report = await db.report.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        targetUserId: true,
        reporterId: true,
        targetType: true,
        reason: true,
        targetModId: true,
        targetCommentId: true,
      },
    })
    if (!report) {
      return notFound('البلاغ غير موجود')
    }

    if (report.status === 'confirmed' || report.status === 'resolved') {
      return validationFail({ status: 'تم معالجة هذا البلاغ مسبقاً' })
    }

    const previousStatus = report.status

    // نحدد هوية صاحب المحتوى مبكراً لاستخدامها في التنفيذ والإشعارات
    let targetUserIdToNotifyEarly = report.targetUserId
    if (report.targetType === 'mod' && report.targetModId) {
      const modEarly = await db.mod.findUnique({
        where: { id: report.targetModId },
        select: { authorId: true },
      })
      if (modEarly) targetUserIdToNotifyEarly = modEarly.authorId
    } else if (report.targetType === 'comment' && report.targetCommentId) {
      const commentEarly = await db.modComment.findUnique({
        where: { id: report.targetCommentId },
        select: { userId: true },
      })
      if (commentEarly?.userId) targetUserIdToNotifyEarly = commentEarly.userId
    }

    // Execute the action — مع تمرير الهدف الفعلي (كاتب التعريب/التعليق) للحظر/التحذير + صلاحيات المنفذ
    await executeAutoAction({
      reportId: id,
      action: action as ReportAction,
      resolution: resolution || '',
      banDuration,
      targetUserId: targetUserIdToNotifyEarly || undefined,
      actorId: moderator.id,
      actorRole: moderator.role,
    })

    // Record status transition
    await db.reportStatusHistory.create({
      data: {
        reportId: id,
        fromStatus: previousStatus as any,
        toStatus: 'confirmed' as any,
        action: action as any,
        resolution: resolution || null,
        actorId: moderator.id,
      },
    })

    // Audit log
    await logAction({
      userId: moderator.id,
      username: moderator.username,
      action: 'report_confirmed',
      entity: 'report',
      entityId: id,
      details: JSON.stringify({ action, resolution, fromStatus: previousStatus }),
      request: req,
    })

    // Phase 2: Update trust scores — المُبلِغ والهدف (حتى لو هدف تعريب/تعليق نحتاج كاتب المحتوى)
    // نستخدم الهوية المحسوبة مبكراً مع تحديث العنوان فقط
    const targetUserIdToNotify = targetUserIdToNotifyEarly
    let targetTitle = 'محتوى'

    if (report.targetType === 'mod' && report.targetModId) {
      const mod = await db.mod.findUnique({
        where: { id: report.targetModId },
        select: { name: true },
      })
      if (mod) targetTitle = mod.name
    } else if (report.targetType === 'comment' && report.targetCommentId) {
      const comment = await db.modComment.findUnique({
        where: { id: report.targetCommentId },
        select: { text: true },
      })
      if (comment) {
        const t = (comment.text || '').trim()
        targetTitle = t.length > 50 ? t.substring(0, 50) + '...' : t || 'تعليق'
      }
    } else if (report.targetType === 'user' && report.targetUserId) {
      const u = await db.user.findUnique({
        where: { id: report.targetUserId },
        select: { username: true },
      })
      if (u) targetTitle = u.username
    }

    if (report.reporterId) {
      await recalculateTrustScore(report.reporterId)
    }
    if (targetUserIdToNotify) {
      await recalculateTrustScore(targetUserIdToNotify)
    }

    // Phase 2: Update repeat offense level — للمستخدم المستهدف الفعلي
    if (targetUserIdToNotify) {
      await updateRepeatOffenseLevel(targetUserIdToNotify)
    }

    // Send notification via use case — للمراسل والمستخدم المتضرر (كاتب التعريب/التعليق)
    if (targetUserIdToNotify && report.reporterId) {
      try {
        const useCases = getUseCases()
        await useCases.sendReportConfirmed.execute({
          reporterId: report.reporterId,
          targetUserId: targetUserIdToNotify,
          reportId: id,
          targetType: report.targetType,
          targetTitle,
          reason: report.reason,
          action,
          resolution,
          moderatorId: moderator.id,
        })
      } catch {}
    } else if (report.reporterId) {
      // حالة عدم وجود هدف للإشعار (مثل تعليق ضيف بدون حساب) — نبلغ المراسل فقط بنتيجة التأكيد
      try {
        const { getNotificationService } = await import(
          '@/infrastructure/di/notification-container'
        )
        const { NotificationType, NotificationChannel } = await import('@/domain')
        const service = getNotificationService()
        await service.send({
          userId: report.reporterId,
          type: NotificationType.AdminAction,
          actorId: moderator.id,
          channels: [NotificationChannel.InApp, NotificationChannel.Email],
          skipDeduplication: true,
          data: { reportId: id, outcome: 'confirmed' },
          templateVariables: {
            targetTitle,
            outcome: 'تم تأكيد البلاغ',
            reason: report.reason,
            resolution,
          },
        })
      } catch {}
    }

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id]/confirm POST] failed:', err)
    return internalError('Failed')
  }
}
