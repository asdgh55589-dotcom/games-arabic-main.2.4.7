import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/comments/[id]/like — إعجاب بتعليق
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'comments:like' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({ where: { id }, select: { id: true, likes: true, dislikes: true } })
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const updated = await db.modComment.update({
      where: { id },
      data: { likes: { increment: 1 } },
      select: { likes: true, dislikes: true },
    })

    return NextResponse.json({ likes: updated.likes, dislikes: updated.dislikes })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
