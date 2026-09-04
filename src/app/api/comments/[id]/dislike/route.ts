import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { ok, unauthorized, notFound, internalError, rateLimited } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/comments/[id]/dislike — عدم إعجاب بتعليق (toggle)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'comments:dislike' })
    if (!rl.success) {
      return rateLimited()
    }

    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized('يجب تسجيل الدخول')
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({
      where: { id },
      select: { id: true, likes: true, dislikes: true },
    })
    if (!comment) {
      return notFound('Comment not found')
    }

    const existing = await db.commentLike.findUnique({
      where: { userId_commentId: { userId: neonUser.id, commentId: id } },
    })

    try {
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
            db.modComment.update({
              where: { id },
              data: { likes: { decrement: 1 }, dislikes: { increment: 1 } },
            }),
          ])
        }
      } else {
        // No previous reaction → add dislike.
        // P2002 (سباق تزامني) يُعالج أدناه.
        await db.$transaction([
          db.commentLike.create({ data: { userId: neonUser.id, commentId: id, value: 'dislike' } }),
          db.modComment.update({ where: { id }, data: { dislikes: { increment: 1 } } }),
        ])
      }
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        const fresh = await db.modComment.findUnique({
          where: { id },
          select: { likes: true, dislikes: true },
        })
        return ok({ disliked: true, likes: fresh?.likes ?? 0, dislikes: fresh?.dislikes ?? 0 })
      }
      throw err
    }

    const updated = await db.modComment.findUnique({
      where: { id },
      select: { likes: true, dislikes: true },
    })

    return ok({
      disliked: !existing || existing.value !== 'dislike',
      likes: updated?.likes ?? 0,
      dislikes: updated?.dislikes ?? 0,
    })
  } catch {
    return internalError('Failed')
  }
}
