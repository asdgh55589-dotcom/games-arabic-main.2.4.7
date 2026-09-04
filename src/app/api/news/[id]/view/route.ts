import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, internalError } from '@/lib/api-response'
import { recordNewsView, isBot } from '@/lib/counters'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/news/[id]/view — تسجيل مشاهدة خبر
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const news = await db.news.findUnique({ where: { id }, select: { id: true } })
    if (!news) return notFound('الخبر غير موجود')

    if (isBot(req.headers.get('user-agent'))) {
      return ok({ counted: false })
    }

    const result = await recordNewsView(id, req as unknown as Request, db)
    return ok({ counted: result.counted })
  } catch (err) {
    console.error('[news view] failed:', err)
    return internalError('Failed')
  }
}
