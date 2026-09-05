import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  internalError,
  notFound,
  ok,
  rateLimited,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { type ReactionValue, reactToComment } from '@/lib/comments/repository'
import { COMMENTS_CONFIG } from '@/lib/comments-config'
import { rateLimit } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

const ReactionSchema = z.object({ value: z.enum(['like', 'dislike']) })

// POST /api/comments/[id]/reaction — تفاعل (like/dislike) مع toggle
// Body: { value: 'like' | 'dislike' }
// يحل محل المسارين القديمين /like و /dislike (حُذفا — نفس السلوك، حد مشترك).
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = await rateLimit(req, {
      limit: COMMENTS_CONFIG.reactionLimit,
      window: COMMENTS_CONFIG.reactionWindowSec,
      keyPrefix: COMMENTS_CONFIG.reactionKeyPrefix,
    })
    if (!rl.success) {
      return rateLimited()
    }

    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized('يجب تسجيل الدخول')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = ReactionSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { id } = await params
    const result = await reactToComment({
      commentId: id,
      userId: neonUser.id,
      value: parsed.data.value as ReactionValue,
    })
    if (!result) {
      return notFound('التعليق غير موجود')
    }
    return ok(result)
  } catch {
    return internalError('فشل التفاعل')
  }
}
