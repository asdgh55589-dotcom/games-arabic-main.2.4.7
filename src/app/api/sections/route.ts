import type { NextRequest } from 'next/server'
import { setCacheControl, withETag } from '@/lib/api-cache'
import { internalError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const sections = await db.section.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        nameEn: true,
        key: true,
        icon: true,
        color: true,
        order: true,
      },
    })

    // LEDA-14 (Fix 5): sections change rarely — same HTTP caching as
    // /api/teams (5 min fresh, 10 min stale + ETag/304). Body shape unchanged.
    const headers = new Headers()
    setCacheControl(headers, { type: 'public', maxAge: 300, swr: 600 })
    return withETag(req, { data: sections }, { headers })
  } catch (err) {
    logger.error('[sections GET] failed:', err)
    return internalError('Failed')
  }
}
