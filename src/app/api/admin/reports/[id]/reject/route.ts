import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { recalculateTrustScore } from '@/lib/reports/trust-score'
import { sendReportRejectedEmail } from '@/lib/notifications/email-service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()
    const { resolution } = body

    const report = await db.report.findUnique({
      where: { id },
      select: { id: true, status: true, reporterId: true, targetType: true, reason: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    await db.report.update({
      where: { id },
      data: {
        status: 'rejected',
        resolution: resolution || 'البلاغ غير مبرر',
        resolvedAt: new Date(),
      },
    })

    // Phase 2: Update trust scores
    if (report.reporterId) {
      await recalculateTrustScore(report.reporterId)
    }

    // Phase 2: Send email notification to reporter
    if (report.reporterId) {
      const reporter = await db.user.findUnique({ where: { id: report.reporterId }, select: { email: true } })
      if (reporter?.email) {
        await sendReportRejectedEmail(reporter.email, {
          reason: report.reason,
          targetType: report.targetType,
          resolution: resolution || 'البلاغ غير مبرر',
        })
      }
    }

    // Existing: Notify reporter via realtime
    if (report.reporterId) {
      await db.notification.create({
        data: {
          userId: report.reporterId,
          type: 'admin_action',
          title: 'نتيجة مراجعة البلاغ',
          message: 'تمت مراجعة بلاغك. لم نجد مخالفة في المحتوى المُبلَّغ.',
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id]/reject POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
