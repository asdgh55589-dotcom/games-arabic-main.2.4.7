import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, internalError } from '@/lib/api-response'
import { recordNewsClick, isBot } from '@/lib/counters'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/news/[id]/click — تسجيل نقرة خبر
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const news = await db.news.findUnique({ where: { id }, select: { id: true } })
    if (!news) return notFound('الخبر غير موجود')

    if (isBot(req.headers.get('user-agent'))) {
      return ok({ counted: false })
    }

    const result = await recordNewsClick(id, req as unknown as Request, db)
    const fresh = await db.news.findUnique({ where: { id }, select: { clicksCount: true } })

    return ok({ counted: result.counted, clicksCount: fresh?.clicksCount ?? 0 })
  } catch (err) {
    console.error('[news click] failed:', err)
    return internalError('Failed')
  }
}
