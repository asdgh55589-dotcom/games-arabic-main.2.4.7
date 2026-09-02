import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications/service'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()

    const body = await req.json()
    const {
      target,
      role,
      userIds,
      type,
      title,
      message,
      channels,
    } = body

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'العنوان والرسالة مطلوبان' }, { status: 400 })
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
      return NextResponse.json({ error: 'حدد المستلمين بشكل صحيح' }, { status: 400 })
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'لا يوجد مستلمون' }, { status: 400 })
    }

    await sendNotification({
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
      details: JSON.stringify({ target, role: role || null, recipientsCount: recipients.length, title }),
      request: req,
    })

    return NextResponse.json({ data: { sent: recipients.length } })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: (error as Error).message }, { status })
    }
    console.error('[admin/notifications/send] Error:', error)
    return NextResponse.json({ error: 'فشل إرسال الإشعار' }, { status: 500 })
  }
}
