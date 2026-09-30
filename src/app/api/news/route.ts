import type { NextRequest } from 'next/server'
import { setCacheControl, withETag } from '@/lib/api-cache'
import { internalError } from '@/lib/api-response'
import { getActiveNews } from '@/lib/news-helpers'
import { logger } from '@/lib/logger'

// GET /api/news?type=ticker|featured — الأخبار النشطة
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || undefined
    const limit = Number.parseInt(searchParams.get('limit') || '20')

    const news = await getActiveNews({ type, limit })

    // Phase 3: ETag + Vary (TTL preserved: 30s fresh, 120s stale)
    const headers = new Headers()
    setCacheControl(headers, { type: 'public', maxAge: 30, swr: 120 })
    return withETag(req, { data: { news } }, { headers })
  } catch (err) {
    logger.error('[api/news] failed:', err)
    return internalError('Failed')
  }
}
