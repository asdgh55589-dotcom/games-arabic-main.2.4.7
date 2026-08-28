import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { ok, unauthorized, notFound, internalError, rateLimited } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/comments/[id]/like — إعجاب بتعليق (toggle)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'comments:like' })
    if (!rl.success) {
      return rateLimited()
    }

    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized('يجب تسجيل الدخول')
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({ where: { id }, select: { id: true, likes: true, dislikes: true } })
    if (!comment) {
      return notFound('Comment not found')
    }

    const existing = await db.commentLike.findUnique({
      where: { userId_commentId: { userId: neonUser.id, commentId: id } },
    })

    try {
      if (existing) {
        if (existing.value === 'like') {
          // Already liked → remove like
          await db.$transaction([
            db.commentLike.delete({ where: { id: existing.id } }),
            db.modComment.update({ where: { id }, data: { likes: { decrement: 1 } } }),
          ])
        } else {
          // Was disliked → switch to like
          await db.$transaction([
            db.commentLike.update({ where: { id: existing.id }, data: { value: 'like' } }),
            db.modComment.update({ where: { id }, data: { likes: { increment: 1 }, dislikes: { decrement: 1 } } }),
          ])
        }
      } else {
        // No previous reaction → add like.
        // P2002 (سباق تزامني: طلبان متوازيان أنشآ الإعجاب معاً) يُعالج أدناه.
        await db.$transaction([
          db.commentLike.create({ data: { userId: neonUser.id, commentId: id, value: 'like' } }),
          db.modComment.update({ where: { id }, data: { likes: { increment: 1 } } }),
        ])
      }
    } catch (err: unknown) {
      // P2002 = unique constraint violation — الإعجاب موجود بالفعل من نداء متوازٍ.
      // نعيد العدادات الحقيقية بدل 500.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        const fresh = await db.modComment.findUnique({ where: { id }, select: { likes: true, dislikes: true } })
        return ok({ liked: true, likes: fresh?.likes ?? 0, dislikes: fresh?.dislikes ?? 0 })
      }
      throw err
    }

    const updated = await db.modComment.findUnique({
      where: { id },
      select: { likes: true, dislikes: true },
    })

    return ok({ liked: !existing || existing.value !== 'like', likes: updated?.likes ?? 0, dislikes: updated?.dislikes ?? 0 })
  } catch {
    return internalError('Failed')
  }
}
