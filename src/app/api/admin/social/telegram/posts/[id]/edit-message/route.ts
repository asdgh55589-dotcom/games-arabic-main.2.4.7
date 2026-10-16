import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { editSentMessages } from '@/lib/social/publish-multi'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const EditMessageSchema = z.object({
  text: z.string().trim().min(1).max(4096).optional(),
  targetId: z.string().min(1).optional(),
})

/**
 * POST /api/admin/social/telegram/posts/[id]/edit-message — تعديل الرسائل
 * المرسلة (editMessageText) لهدف معين أو كل المُرسلة. كل نجاح يُوثَّق
 * بصف تسليم + رقم مراجعة في التدقيق.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireManager()
    const { id } = await params

    const raw = await req.json().catch(() => ({}))
    const parsed = EditMessageSchema.safeParse(raw)
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

    const result = await editSentMessages(id, {
      text: parsed.data.text,
      targetId: parsed.data.targetId,
      actor: { id: user.id, username: user.username },
    })

    return ok({
      edited: result.edited,
      failed: result.failed,
      failures: result.failures,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — تعديل الرسائل للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/posts/[id]/edit-message POST] failed:', err)
    return internalError('تعذّر تعديل الرسائل')
  }
}
