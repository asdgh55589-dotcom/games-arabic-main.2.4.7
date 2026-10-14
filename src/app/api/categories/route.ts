import type { NextRequest } from 'next/server'
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

    return withReadObserveHeaders(req, ok(categories))
  } catch (err) {
    logger.error('[categories GET] failed:', err)
    return internalError('Failed')
  }
}
