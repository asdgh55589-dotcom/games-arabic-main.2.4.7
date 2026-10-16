import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { deleteSentMessages } from '@/lib/social/publish-multi'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const DeleteMessageSchema = z.object({
  targetId: z.string().min(1).optional(),
})

/**
 * POST /api/admin/social/telegram/posts/[id]/delete-message — حذف الرسائل
 * المرسلة (deleteMessage) لهدف معين أو كل المُرسلة. الهدف الناجح يُعلَّم
 * `skipped` (لم يعد منشوراً ولا يُعاد إرساله) مع بقاء سجل التسليم.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireManager()
    const { id } = await params

    const raw = await req.json().catch(() => ({}))
    const parsed = DeleteMessageSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات غير صالحة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const result = await deleteSentMessages(id, {
      targetId: parsed.data.targetId,
      actor: { id: user.id, username: user.username },
    })

    return ok({
      deleted: result.edited,
      failed: result.failed,
      failures: result.failures,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — حذف الرسائل للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/posts/[id]/delete-message POST] failed:', err)
    return internalError('تعذّر حذف الرسائل')
  }
}
