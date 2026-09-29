import { type NextRequest, NextResponse } from 'next/server'
import {
  conflict,
  forbidden,
  internalError,
  notFound,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireModerator()
    const body = await req.json()
    const { jobId } = body

    if (!jobId) {
      return validationFail(
        { formErrors: ['معرف الوظيفة مطلوب'], fieldErrors: {} },
        req.nextUrl.pathname,
      )
    }

    const job = await db.notificationJob.findUnique({ where: { id: jobId } })

    if (!job) {
      return notFound('الوظيفة غير موجودة')
    }

    if (job.status !== 'failed' && job.status !== 'dead_letter') {
      return conflict('لا يمكن إعادة إرسال وظيفة غير فاشلة')
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
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — هذه الصفحة للمشرفين فقط')
    logger.error({ err: error, route: 'POST /api/admin/notifications/retry' }, 'Failed to retry notification job')
    return internalError('فشل إعادة الإرسال')
  }
}
