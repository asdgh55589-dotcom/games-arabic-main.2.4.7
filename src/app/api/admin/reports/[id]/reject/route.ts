import type { NextRequest } from 'next/server'
import { getUseCases } from '@/application/use-cases/factory'
import { fail, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { isValidTransition } from '@/lib/reports/constants'
import { checkReporterStrikes } from '@/lib/reports/reporter-strike'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const moderator = await requireModerator()
    const { id } = await params
    const body = await req.json()
    const { resolution } = body

    const report = await db.report.findUnique({
      where: { id },
      select: { id: true, status: true, reporterId: true, targetType: true, reason: true },
    })
    if (!report) {
      return notFound('البلاغ غير موجود')
    }

    if (!isValidTransition(report.status, 'rejected')) {
      return validationFail({ status: 'لا يمكن رفض بلاغ في هذه الحالة' })
    }

    const previousStatus = report.status

    const rejected = await db.report.updateMany({
      where: { id, status: previousStatus },
      data: {
        status: 'rejected',
        resolution: resolution || 'البلاغ غير مبرر',
        resolvedAt: new Date(),
      },
    })
    if (rejected.count === 0) {
      return fail('CONFLICT', 'تغيّرت حالة البلاغ — أعد المحاولة', 409)
    }

    // Record status transition
    await db.reportStatusHistory.create({
      data: {
        reportId: id,
        fromStatus: previousStatus,
        toStatus: 'rejected',
        action: null,
        resolution: resolution || 'البلاغ غير مبرر',
        actorId: moderator.id,
      },
    })

    // Audit log
    await logAction({
      userId: moderator.id,
      username: moderator.username,
      action: 'report_rejected',
      entity: 'report',
      entityId: id,
      details: JSON.stringify({
        resolution: resolution || 'البلاغ غير مبرر',
        fromStatus: previousStatus,
      }),
      request: req,
    })

    // Phase 2: Update trust scores + فحص عقوبات المُبلّغ الكيدي
    if (report.reporterId) {
      await recalculateTrustScore(report.reporterId)
      await checkReporterStrikes(report.reporterId).catch((err) =>
        logger.error('[reject] checkReporterStrikes failed:', err),
      )
    }

    // Send notification via use case (replaces email + direct db.notification.create)
    if (report.reporterId) {
      try {
        const useCases = getUseCases()
        await useCases.sendReportRejected.execute({
          reporterId: report.reporterId,
          reportId: id,
          targetType: report.targetType,
          targetTitle: id,
          reason: report.reason,
          resolution: resolution || 'البلاغ غير مبرر',
          moderatorId: moderator.id,
        })
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notification
      }
    }

    return ok({ success: true })
  } catch (err) {
    logger.error('[admin/reports/[id]/reject POST] failed:', err)
    return internalError('Failed')
  }
}
