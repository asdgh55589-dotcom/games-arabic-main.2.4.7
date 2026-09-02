import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireModerator()
    const body = await req.json()
    const { jobId } = body

    if (!jobId) {
      return NextResponse.json({ error: 'معرف الوظيفة مطلوب' }, { status: 400 })
    }

    const job = await db.notificationJob.findUnique({ where: { id: jobId } })

    if (!job) {
      return NextResponse.json({ error: 'الوظيفة غير موجودة' }, { status: 404 })
    }

    if (job.status !== 'failed' && job.status !== 'dead_letter') {
      return NextResponse.json({ error: 'لا يمكن إعادة إرسال وظيفة غير فاشلة' }, { status: 400 })
    }

    await db.notificationJob.update({
      where: { id: jobId },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
      },
    })

    await logAction({
      userId: admin.id,
      username: admin.username,
      action: 'NOTIFICATION_RETRIED',
      entity: 'NotificationJob',
      entityId: jobId,
      details: JSON.stringify({ channel: job.channel }),
      request: req,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: (error as Error).message }, { status })
    }
    console.error('[admin/notifications/retry] Error:', error)
    return NextResponse.json({ error: 'فشل إعادة الإرسال' }, { status: 500 })
  }
}
