import { type NextRequest, NextResponse } from 'next/server'
import { forbidden, internalError, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendNotification } from '@/lib/notifications/service'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()

    const body = await req.json()
    const { target, role, userIds, type, title, message, channels } = body

    if (!title?.trim() || !message?.trim()) {
      return validationFail(
        { formErrors: ['العنوان والرسالة مطلوبان'], fieldErrors: {} },
        req.nextUrl.pathname,
      )
    }

    const effectiveChannels: ('in_app' | 'email' | 'telegram')[] =
      Array.isArray(channels) && channels.length > 0 ? channels : ['in_app']

    let recipients: { id: string; username: string; displayName: string | null }[] = []

    if (target === 'all') {
      recipients = await db.user.findMany({
        where: { banStatus: 'active' },
        select: { id: true, username: true, displayName: true },
      })
    } else if (target === 'role' && role) {
      recipients = await db.user.findMany({
        where: { role, banStatus: 'active' },
        select: { id: true, username: true, displayName: true },
      })
    } else if (target === 'users' && Array.isArray(userIds) && userIds.length > 0) {
      recipients = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, displayName: true },
      })
    } else {
      return validationFail(
        { formErrors: ['حدد المستلمين بشكل صحيح'], fieldErrors: {} },
        req.nextUrl.pathname,
      )
    }

    if (recipients.length === 0) {
      return validationFail(
        { formErrors: ['لا يوجد مستلمون'], fieldErrors: {} },
        req.nextUrl.pathname,
      )
    }

    const result = await sendNotification({
      type: type || 'system_alert',
      title: title.trim(),
      message: message.trim(),
      recipients: recipients.map((r) => ({ userId: r.id, channels: effectiveChannels })),
      actorId: admin.id,
      data: { sentBy: admin.username, target },
    } as never)

    await logAction({
      userId: admin.id,
      username: admin.username,
      action: 'NOTIFICATION_SENT',
      entity: 'notification',
      details: JSON.stringify({
        target,
        role: role || null,
        recipientsCount: recipients.length,
        createdCount: result.created,
        skippedCount: result.skipped,
        queuedCount: result.queued,
        deduplicatedCount: result.deduplicated,
        channels: effectiveChannels,
        title,
      }),
      request: req,
    })

    // `sent` كان دائماً يساوي عدد المستلمين المطابقين، أي رقم لا علاقة له بما حدث فعلاً.
    // نُرجع ما أُنشئ وما تخطّي وما دخل الطابور بانتظار عامل التصريف (cron)
    // وما استبعدته نافذة منع التكرار.
    return NextResponse.json({
      data: {
        created: result.created,
        skipped: result.skipped,
        queued: result.queued,
        deduplicated: result.deduplicated,
        channels: effectiveChannels,
      },
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    logger.error(
      { err: error, route: 'POST /api/admin/notifications/send' },
      'Failed to send notification',
    )
    return internalError('فشل إرسال الإشعار')
  }
}
