import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

export async function GET() {
  try {
    await requireAdmin()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      bannedUsers,
      newUsersThisMonth,
      newUsersLastMonth,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({
        where: {
          lastLoginAt: { gte: thirtyDaysAgo },
        },
      }),
      db.user.count({
        where: {
          lastLoginAt: { lt: thirtyDaysAgo },
          loginCount: { gt: 0 },
        },
      }),
      db.user.count({
        where: {
          banStatus: { not: 'active' },
        },
      }),
      db.user.count({
        where: {
          joinedAt: { gte: startOfMonth },
        },
      }),
      db.user.count({
        where: {
          joinedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
    ])

    const growthRate =
      newUsersLastMonth > 0
        ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
        : newUsersThisMonth > 0
          ? 100
          : 0

    return ok({
      totalUsers,
      activeUsers,
      inactiveUsers,
      bannedUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      growthRate: Math.round(growthRate * 10) / 10,
    })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
