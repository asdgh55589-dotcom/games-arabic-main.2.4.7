import type { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { withReadObserveHeaders } from '@/lib/read-observe'

// GET /api/ads — جلب إعلانات الصفحة الرئيسية (المرئية فقط)
export async function GET(req: NextRequest) {
  try {
    const ads = await db.homepageAd.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    })

    return withReadObserveHeaders(req, ok({ ads }))
  } catch (err) {
    logger.error('[api/ads] failed:', err)
    return ok({ ads: [] })
  }
}
