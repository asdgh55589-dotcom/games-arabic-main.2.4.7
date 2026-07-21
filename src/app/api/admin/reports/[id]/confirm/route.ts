import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { executeAutoAction } from '@/lib/reports/auto-actions'
import { REPORT_ACTIONS, type ReportAction } from '@/lib/reports/constants'
import { sendRealtimeNotification } from '@/lib/notifications/realtime'

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
      select: { id: true, status: true, targetUserId: true },
    })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    if (report.status === 'confirmed' || report.status === 'resolved') {
      return NextResponse.json({ error: 'تم معالجة هذا البلاغ مسبقاً' }, { status: 400 })
    }

    await executeAutoAction({
      reportId: id,
      action: action as ReportAction,
      resolution: resolution || '',
      banDuration,
      targetUserId: report.targetUserId || undefined,
    })

    if (report.targetUserId) {
      await db.notification.create({
        data: {
          userId: report.targetUserId,
          type: 'admin_action',
          title: 'نتيجة مراجعة البلاغ',
          message: `تمت مراجعة بلاغ مقترض ضد محتواك. النتيجة: ${REPORT_ACTIONS[action as ReportAction]?.label || action}`,
        },
      })
      await sendRealtimeNotification(report.targetUserId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id]/confirm POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
