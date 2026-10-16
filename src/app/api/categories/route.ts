import type { NextRequest } from 'next/server'
import { setCacheControl } from '@/lib/api-cache'
import { internalError, ok } from '@/lib/api-response'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { withReadObserveHeaders } from '@/lib/read-observe'

export async function GET(req: NextRequest) {
  try {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        gameId: true,
      },
    })

    // Section 4 item 27: categories change rarely — public cache like sections.
    const res = await withReadObserveHeaders(req, ok(categories))
    setCacheControl(res.headers, { type: 'public', maxAge: 300, swr: 600 })
    return res
  } catch (err) {
    logger.error('[categories GET] failed:', err)
    return internalError('Failed')
  }
}
