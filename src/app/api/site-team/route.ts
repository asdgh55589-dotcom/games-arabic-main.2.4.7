import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

// Hierarchy for sorting — lower index = higher rank
const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  manager: 1,
  admin: 2,
  moderator: 3,
}

const STAFF_ROLES = ['owner', 'manager', 'admin', 'moderator'] as const

// GET /api/site-team — قائمة مسؤولي الموقع (عام، بدون مصادقة)
export async function GET() {
  try {
    const staff = await db.user.findMany({
      where: {
        role: { in: [...STAFF_ROLES] },
        // exclude banned users
        banStatus: 'active',
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        role: true,
        lastLoginAt: true,
        joinedAt: true,
        tier: true,
      },
      take: 20,
    })

    // Sort by hierarchy then by lastLoginAt (recent first)
    staff.sort((a, b) => {
      const orderA = ROLE_ORDER[a.role] ?? 99
      const orderB = ROLE_ORDER[b.role] ?? 99
      if (orderA !== orderB) return orderA - orderB
      const timeA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0
      const timeB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0
      return timeB - timeA
    })

    const now = Date.now()
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 دقائق = متصل الآن

    const data = staff.map((u) => {
      const lastLoginTime = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0
      const isOnline = lastLoginTime > 0 && now - lastLoginTime < ONLINE_THRESHOLD_MS
      return {
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        role: u.role,
        tier: u.tier,
        joinedAt: u.joinedAt,
        lastLoginAt: u.lastLoginAt,
        isOnline,
      }
    })

    return ok(data, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    })
  } catch (err) {
    console.error('[api/site-team] failed:', err)
    return internalError('Failed to load site team')
  }
}
