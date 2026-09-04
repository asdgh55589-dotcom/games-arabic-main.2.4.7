import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

// GET /api/notifications/unread — الإشعارات غير المقروءة
export async function GET(_req: NextRequest) {
  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return ok([])
    }

    const rawNotifications = await db.notification.findMany({
      where: {
        userId: neonUser.id,
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        data: true,
        readAt: true,
        createdAt: true,
        actor: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    })

    const notifications = rawNotifications.map((n) => ({
      ...n,
      actor: n.actor || null,
      link: (n.data as any)?.link || null,
    }))

    return ok(notifications)
  } catch (err) {
    console.error('[notifications unread GET] failed:', err)
    return internalError('Failed')
  }
}
