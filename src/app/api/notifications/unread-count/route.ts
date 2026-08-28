import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok } from '@/lib/api-response'

// GET /api/notifications/unread-count — عدد الإشعارات غير المقروءة
export async function GET() {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return ok({ count: 0 })
    }

    const count = await db.notification.count({
      where: { userId: user.id, readAt: null },
    })

    return ok({ count })
  } catch (err) {
    console.error('[unread-count GET] failed:', err)
    return ok({ count: 0 })
  }
}
