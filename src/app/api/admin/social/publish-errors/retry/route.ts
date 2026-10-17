/**
 * POST /api/admin/social/publish-errors/retry — «أعد الوجهات الفاشلة» (مرحلة 6).
 *
 * كتابة requireManager: يستقبل `{ postId }` (المرجع من حدث نطاق post) ويعيد
 * تشغيل محرك النشر المتعدد لهذا المنشور — الأهداف المُرسَلة تُتخطى
 * (المطالبة الذرّية لا ترسل مرة واحدة)، والفاشلة تعاد. النجاح يحس الأحداث
 * تلقائياً عبر مسار التجميع داخل المحرك (resolvePublishErrorsOpen).
 * لا إعادة كتابة أي محتوى — الزر يعيد فقط الأهداف الفاشلة.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { publishSocialPostMulti } from '@/lib/social/publish-multi'
import { authErrorResponse } from '@/lib/template-lifecycle'

const RetrySchema = z.object({
  postId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireManager()
    const raw = await req.json().catch(() => null)
    const parsed = RetrySchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'معرّف المنشور مطلوب',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const post = await db.socialPost.findUnique({
      where: { id: parsed.data.postId },
      select: { id: true },
    })
    if (!post) {
      return fail('NOT_FOUND', 'المنشور غير موجود', 404, undefined, undefined, req.nextUrl.pathname)
    }

    const result = await publishSocialPostMulti(parsed.data.postId, {
      source: 'manual',
      actor: { id: user.id, username: user.username },
    })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'publish_errors_retry',
      entity: 'social_post',
      entityId: parsed.data.postId,
      details: `أعد الوجهات الفاشلة: ${result.published} ناجح / ${result.failed} فاشل`,
      request: req,
    })

    return ok({
      published: result.published,
      failed: result.failed,
      skipped: result.skipped,
      targets: result.targets,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إعادة المحاولة للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/publish-errors/retry POST] failed:', err)
    return internalError('تعذّرت إعادة المحاولة', undefined, req.nextUrl.pathname)
  }
}

export const dynamic = 'force-dynamic'
