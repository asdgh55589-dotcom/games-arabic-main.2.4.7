import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUserIdFromRequestCookies } from '@/lib/auth'
import { getClientIP } from '@/lib/counters'
import { ok, internalError } from '@/lib/api-response'

// POST /api/search/track — تتبع استعلامات البحث
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query || query.length < 2) {
      return ok({ tracked: false, reason: 'query too short' })
    }
    if (query.length > 200) {
      return ok({ tracked: false, reason: 'query too long' })
    }

    const userId = await getUserIdFromRequestCookies(req as unknown as Request).catch(() => null)
    const ip = getClientIP(req as unknown as Request)

    await db.searchClick.create({
      data: { query, userId: userId || null, ipAddress: ip },
    })

    return ok({ tracked: true })
  } catch (err) {
    console.error('[search/track] failed:', err)
    return internalError('Failed to track search')
  }
}
