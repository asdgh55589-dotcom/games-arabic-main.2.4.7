import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { executeAutoAction } from '@/lib/reports/auto-actions'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
import { updateRepeatOffenseLevel } from '@/lib/reports/repeat-offender'
import { REPORT_ACTIONS, type ReportAction } from '@/lib/reports/constants'
import { sendReportConfirmedEmail, sendReportActionEmail } from '@/lib/notifications/email-service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()
    const { action, resolution, banDuration } = body

    if (!action || !(action in REPORT_ACTIONS)) {
      return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 })
    }

    const report = await db.report.findUnique({
      where: { id },
      select: { id: true, status: true, targetUserId: true, reporterId: true, targetType: true, reason: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    if (report.status === 'confirmed' || report.status === 'resolved') {
      return NextResponse.json({ error: 'تم معالجة هذا البلاغ مسبقاً' }, { status: 400 })
    }

    // Execute the action
    await executeAutoAction({
      reportId: id,
      action: action as ReportAction,
      resolution: resolution || '',
      banDuration,
      targetUserId: report.targetUserId || undefined,
    })

    // Phase 2: Update trust scores
    if (report.reporterId) {
      await recalculateTrustScore(report.reporterId)
    }
    if (report.targetUserId) {
      await recalculateTrustScore(report.targetUserId)
    }

    // Phase 2: Update repeat offense level
    if (report.targetUserId) {
      await updateRepeatOffenseLevel(report.targetUserId)
    }

    // Phase 2: Send email notifications
    if (report.reporterId) {
      const reporter = await db.user.findUnique({ where: { id: report.reporterId }, select: { email: true } })
      if (reporter?.email) {
        await sendReportConfirmedEmail(reporter.email, { reason: report.reason, targetType: report.targetType })
      }
    }

    if (report.targetUserId) {
      const targetUser = await db.user.findUnique({ where: { id: report.targetUserId }, select: { email: true } })
      if (targetUser?.email) {
        await sendReportActionEmail(targetUser.email, { reason: report.reason, targetType: report.targetType }, action)
      }
    }

    // Existing: Notify target user via realtime
    if (report.targetUserId) {
      await db.notification.create({
        data: {
          userId: report.targetUserId,
          type: 'admin_action',
          title: 'نتيجة مراجعة البلاغ',
          message: `تمت مراجعة بلاغ مقترض ضد محتواك. النتيجة: ${REPORT_ACTIONS[action as ReportAction]?.label || action}`,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id]/confirm POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
