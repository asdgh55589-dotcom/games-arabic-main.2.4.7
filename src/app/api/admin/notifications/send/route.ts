import { type NextRequest, NextResponse } from 'next/server'
import { fail, forbidden, internalError, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendNotification } from '@/lib/notifications/service'

export async function POST(req: NextRequest) {
  try {
    // P3: الإرسال الجماعي لا يقلّ صلاحيةً عن تحرير القوالب (requireManager).
    // كان requireAdmin — أي أن المدير (admin) كان يُمنع من تعديل القالب لكنه يقدر
    // يبثّ إشعاراً لجميع المستخدمين: انعكاس صلاحيات. نرفع الطرف الأضعف لا نضعف الأقوى.
    const admin = await requireManager()

    const body = await req.json()
    const { target, role, userIds, type, title, message, channels } = body

    if (!title?.trim() || !message?.trim()) {
      return fail(
        'VALIDATION_ERROR',
        'العنوان والرسالة مطلوبان',
        422,
        { formErrors: ['العنوان والرسالة مطلوبان'], fieldErrors: {} },
        undefined,
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
      return fail(
        'VALIDATION_ERROR',
        'حدد المستلمين بشكل صحيح',
        422,
        { formErrors: ['حدد المستلمين بشكل صحيح'], fieldErrors: {} },
        undefined,
        req.nextUrl.pathname,
      )
    }

    if (recipients.length === 0) {
      return fail(
        'VALIDATION_ERROR',
        'لا يوجد مستلمون',
        422,
        { formErrors: ['لا يوجد مستلمون'], fieldErrors: {} },
        undefined,
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
        channels: effectiveChannels,
        title,
      }),
      request: req,
    })

    // `sent` كان دائماً يساوي عدد المستلمين المطابقين، أي رقم لا علاقة له بما حدث فعلاً.
    // نُرجع ما أنشئ وما تخطي وما بقي في الطابور بلا عامل معالجة.
    return NextResponse.json({
      data: {
        created: result.created,
        skipped: result.skipped,
        queued: result.queued,
        channels: effectiveChannels,
      },
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — هذه الصفحة للمديرين فقط')
    logger.error(
      { err: error, route: 'POST /api/admin/notifications/send' },
      'Failed to send notification',
    )
    return internalError('فشل إرسال الإشعار')
  }
}
