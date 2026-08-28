import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { isValidTransition } from '@/lib/reports/constants'
import { logAction } from '@/lib/audit'
import { ok, notFound, validationFail, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const report = await db.report.findUnique({
      where: { id },
      select: {
        id: true,
        targetType: true,
        reason: true,
        priority: true,
        status: true,
        description: true,
        evidenceUrls: true,
        actionTaken: true,
        actionAt: true,
        resolution: true,
        resolvedAt: true,
        ipAddress: true,
        createdAt: true,
        fraudScore: true,
        repeatOffenseLevel: true,
        reporter: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            role: true,
            trustScore: {
              select: {
                score: true,
                totalReports: true,
                confirmedReports: true,
                rejectedReports: true,
                reportAccuracy: true,
              },
            },
          },
        },
        targetMod: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
        targetComment: { select: { id: true, text: true, createdAt: true } },
        targetUser: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            role: true,
            trustScore: {
              select: {
                score: true,
                totalReports: true,
                confirmedReports: true,
                rejectedReports: true,
                reportAccuracy: true,
              },
            },
          },
        },
        assignedToId: true,
        assignedTo: { select: { id: true, username: true, avatarUrl: true } },
        fraudSignals: {
          select: {
            id: true,
            signalType: true,
            score: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!report) {
      return notFound('البلاغ غير موجود')
    }

    let previousReports = 0
    if (report.targetMod) {
      previousReports = await db.report.count({
        where: { targetModId: report.targetMod.id, id: { not: id } },
      })
    } else if (report.targetComment) {
      previousReports = await db.report.count({
        where: { targetCommentId: report.targetComment.id, id: { not: id } },
      })
    } else if (report.targetUser) {
      previousReports = await db.report.count({
        where: { targetUserId: report.targetUser.id, id: { not: id } },
      })
    }

    return ok({ report: { ...report, previousReports } })
  } catch (err) {
    console.error('[admin/reports/[id] GET] failed:', err)
    return internalError('Failed')
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const moderator = await requireModerator()
    const { id } = await params
    const body = await req.json()

    const report = await db.report.findUnique({ where: { id }, select: { id: true, status: true, reporterId: true } })
    if (!report) {
      return notFound('البلاغ غير موجود')
    }

    // Validate status transition if status is being changed
    if (body.status && body.status !== report.status) {
      if (!isValidTransition(report.status, body.status)) {
        return validationFail({
          status: `لا يمكن التحديل من "${report.status}" إلى "${body.status}"`,
        })
      }
    }

    // Validate assignedToId if provided — يجب أن يكون مشرفاً
    if (body.assignedToId !== undefined && body.assignedToId !== null && body.assignedToId !== '') {
      const assignee = await db.user.findUnique({
        where: { id: body.assignedToId },
        select: { id: true, role: true },
      })
      if (!assignee || !['moderator', 'manager', 'admin', 'owner'].includes(assignee.role)) {
        return validationFail('المستخدم المعين ليس مشرفاً')
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status as any
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null
    if (body.resolution !== undefined) updateData.resolution = body.resolution

    await db.report.update({ where: { id }, data: updateData as any })

    // Record status transition if status changed
    if (body.status && body.status !== report.status) {
      await db.reportStatusHistory.create({
        data: {
          reportId: id,
          fromStatus: report.status as any,
          toStatus: body.status as any,
          action: null,
          resolution: body.resolution || null,
          actorId: moderator.id,
        },
      })

      await logAction({
        userId: moderator.id,
        username: moderator.username,
        action: 'report_status_changed',
        entity: 'report',
        entityId: id,
        details: JSON.stringify({ fromStatus: report.status, toStatus: body.status }),
        request: req,
      })

      // إشعار المُبلِّغ عند دخول البلاغ قيد المراجعة
      if (body.status === 'under_review' && report.reporterId) {
        await db.notification
          .create({
            data: {
              userId: report.reporterId,
              type: 'report_update',
              title: '🔍 بلاغك قيد المراجعة',
              message: 'بدأ فريق الإشراف بمراجعة بلاغك. سيتم إشعارك بالنتيجة.',
            },
          })
          .catch((err) => console.error('[PATCH] notify under_review failed:', err))
      }
    }

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id] PATCH] failed:', err)
    return internalError('Failed')
  }
}
