import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, internalError } from '@/lib/api-response'
import { recordAdClick, isBot } from '@/lib/counters'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/ads/[id]/click — تسجيل نقرة إعلان مع deduplication
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const ad = await db.homepageAd.findUnique({ where: { id }, select: { id: true } })
    if (!ad) return notFound('الإعلان غير موجود')

    if (isBot(req.headers.get('user-agent'))) {
      return ok({ counted: false, clicksCount: 0 })
    }

    const result = await recordAdClick(id, req as unknown as Request, db)
    const freshAd = await db.homepageAd.findUnique({ where: { id }, select: { clicksCount: true } })

    return ok({ counted: result.counted, clicksCount: freshAd?.clicksCount ?? 0 })
  } catch (err) {
    console.error('[ads click] failed:', err)
    return internalError('Failed')
  }
}
