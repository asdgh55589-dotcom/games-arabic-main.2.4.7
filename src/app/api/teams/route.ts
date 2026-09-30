import type { NextRequest } from 'next/server'
import { setCacheControl, withETag } from '@/lib/api-cache'
import { internalError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/teams — قائمة بكل فرق التعريب
export async function GET(req: NextRequest) {
  try {
    const teams = await db.team.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        isFeatured: true,
        isOfficial: true,
        modCount: true,
      },
    })

    // Phase 3: ETag + Vary (TTL preserved: 300s fresh, 600s stale)
    const headers = new Headers()
    setCacheControl(headers, { type: 'public', maxAge: 300, swr: 600 })
    return withETag(req, { data: teams }, { headers })
  } catch (err) {
    logger.error('[api/teams] failed:', err)
    return internalError('Failed to fetch teams')
  }
}
