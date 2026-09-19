import { ok } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getCachedUnreadCount, setCachedUnreadCount } from '@/lib/notification-cache'

// GET /api/notifications/unread-count — عدد الإشعارات غير المقروءة
// Cached 60s per user (the polling hook hits this every 30s per tab).
export async function GET() {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return ok({ count: 0 })
    }

    const cached = await getCachedUnreadCount(user.id)
    if (cached !== null) {
      return ok({ count: cached })
    }

    const count = await db.notification.count({
      where: { userId: user.id, readAt: null },
    })

    await setCachedUnreadCount(user.id, count)

    return ok({ count })
  } catch (err) {
    console.error('[unread-count GET] failed:', err)
    return ok({ count: 0 })
  }
}
