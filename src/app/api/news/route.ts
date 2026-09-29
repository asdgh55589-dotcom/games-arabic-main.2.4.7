import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { getActiveNews } from '@/lib/news-helpers'
import { logger } from '@/lib/logger'

// GET /api/news?type=ticker|featured — الأخبار النشطة
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || undefined
    const limit = Number.parseInt(searchParams.get('limit') || '20')

    const news = await getActiveNews({ type, limit })

    return ok(
      { news },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        },
      },
    )
  } catch (err) {
    logger.error('[api/news] failed:', err)
    return internalError('Failed')
  }
}
