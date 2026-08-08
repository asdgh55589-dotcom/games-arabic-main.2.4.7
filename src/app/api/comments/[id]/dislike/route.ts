import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/comments/[id]/dislike — عدم إعجاب بتعليق (toggle)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'comments:dislike' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 401 })
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({ where: { id }, select: { id: true, likes: true, dislikes: true } })
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const existing = await db.commentLike.findUnique({
      where: { userId_commentId: { userId: neonUser.id, commentId: id } },
    })

    if (existing) {
      if (existing.value === 'dislike') {
        // Already disliked → remove dislike
        await db.$transaction([
          db.commentLike.delete({ where: { id: existing.id } }),
          db.modComment.update({ where: { id }, data: { dislikes: { decrement: 1 } } }),
        ])
      } else {
        // Was liked → switch to dislike
        await db.$transaction([
          db.commentLike.update({ where: { id: existing.id }, data: { value: 'dislike' } }),
          db.modComment.update({ where: { id }, data: { likes: { decrement: 1 }, dislikes: { increment: 1 } } }),
        ])
      }
    } else {
      // No previous reaction → add dislike
      await db.$transaction([
        db.commentLike.create({ data: { userId: neonUser.id, commentId: id, value: 'dislike' } }),
        db.modComment.update({ where: { id }, data: { dislikes: { increment: 1 } } }),
      ])
    }

    const updated = await db.modComment.findUnique({
      where: { id },
      select: { likes: true, dislikes: true },
    })

    return NextResponse.json({ likes: updated?.likes ?? 0, dislikes: updated?.dislikes ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
