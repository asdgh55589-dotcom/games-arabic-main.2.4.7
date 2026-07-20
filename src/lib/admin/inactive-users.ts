import { db } from '@/lib/db'

interface InactiveUsersConfig {
  daysThreshold: number
  includeWithNoActivity: boolean
}

export async function getInactiveUsers(config: InactiveUsersConfig) {
  const thresholdDate = new Date(Date.now() - config.daysThreshold * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    lastLoginAt: { lt: thresholdDate }
  }

  if (!config.includeWithNoActivity) {
    where.loginCount = { gt: 0 }
  }

  const users = await db.user.findMany({
    where,
    include: {
      _count: {
        select: {
          mods: true,
          endorsements: true,
        }
      },
      mods: {
        select: {
          downloads: true
        }
      }
    },
    orderBy: { lastLoginAt: 'asc' }
  })

  return users.map(user => ({
    id: user.id,
    username: user.username,
    email: user.email,
    lastLoginAt: user.lastLoginAt,
    daysSinceLastLogin: user.lastLoginAt
      ? Math.floor((Date.now() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    modCount: user._count.mods,
    totalDownloads: user.mods.reduce((sum, mod) => sum + mod.downloads, 0)
  }))
}
