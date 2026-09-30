import type { NextRequest } from 'next/server'
import { setCacheControl, withETag } from '@/lib/api-cache'
import { internalError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/series — قائمة بكل السلاسل (من Series model الجديد)
export async function GET(req: NextRequest) {
  try {
    const series = await db.series.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        bannerUrl: true,
        logoUrl: true,
        color: true,
        isFeatured: true,
        isOfficial: true,
        modCount: true,
        totalDownloads: true,
        totalEndorsements: true,
      },
    })

    // Phase 3: ETag + Vary (TTL preserved: 300s fresh, 600s stale)
    const headers = new Headers()
    setCacheControl(headers, { type: 'public', maxAge: 300, swr: 600 })
    return withETag(req, { data: series }, { headers })
  } catch (err) {
    logger.error('[api/series] failed:', err)
    return internalError('Failed to fetch series')
  }
}
