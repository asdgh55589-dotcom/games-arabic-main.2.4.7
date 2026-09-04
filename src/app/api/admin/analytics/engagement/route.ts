import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

export async function GET() {
  try {
    await requireModerator()

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const [comments, endorsements, activeUsers] = await Promise.all([
      db.modComment.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
      db.endorsement.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
      db.userAction.findMany({
        where: {
          action: 'login',
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
      }),
    ])

    // Build daily maps for last 30 days
    const buildDailyMap = (items: { createdAt: Date }[]) => {
      const map = new Map<string, number>()
      for (let i = 0; i < 30; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() - 29 + i)
        map.set(d.toISOString().split('T')[0], 0)
      }
      for (const item of items) {
        const key = new Date(item.createdAt).toISOString().split('T')[0]
        map.set(key, (map.get(key) || 0) + 1)
      }
      return Array.from(map.entries()).map(([date, count]) => ({ date, count }))
    }

    const commentsDaily = buildDailyMap(comments)
    const endorsementsDaily = buildDailyMap(endorsements)
    const activeUsersDaily = buildDailyMap(activeUsers)

    // Average daily active users
    const avgSession =
      activeUsersDaily.length > 0
        ? Math.round(activeUsersDaily.reduce((s, d) => s + d.count, 0) / activeUsersDaily.length)
        : 0

    return ok(
      {
        comments: commentsDaily,
        endorsements: endorsementsDaily,
        activeUsers: activeUsersDaily,
        avgDailyActive: avgSession,
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (err) {
    console.error('[admin/analytics/engagement] failed:', err)
    return internalError('Failed to load engagement analytics')
  }
}
