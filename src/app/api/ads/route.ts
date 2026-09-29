import { ok } from '@/lib/api-response'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/ads — جلب إعلانات الصفحة الرئيسية (المرئية فقط)
export async function GET() {
  try {
    const ads = await db.homepageAd.findMany({
      where: { visible: true },
      orderBy: { order: 'asc' },
    })

    return ok({ ads })
  } catch (err) {
    logger.error('[api/ads] failed:', err)
    return ok({ ads: [] })
  }
}
