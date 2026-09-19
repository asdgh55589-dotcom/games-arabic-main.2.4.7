import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateUnreadCache } from '@/lib/notification-cache'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/notifications/[id]/read — تعيين إشعار كمقروء
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getOptionalSession()
    if (!user) return unauthorized()

    const { id } = await params

    const notification = await db.notification.findFirst({
      where: { id, userId: user.id },
      select: { id: true, readAt: true },
    })
    if (!notification) return notFound()

    if (notification.readAt) {
      return ok({ success: true })
    }

    await db.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    await invalidateUnreadCache(user.id)

    return ok({ success: true })
  } catch (err) {
    console.error('[notification read POST] failed:', err)
    return internalError('Failed')
  }
}
