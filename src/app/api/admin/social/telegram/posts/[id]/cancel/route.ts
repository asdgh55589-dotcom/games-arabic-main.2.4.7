/**
 * POST /api/admin/social/telegram/posts/[id]/cancel — إلغاء الجدولة.
 *
 * يحوّل منشوراً مجدولاً/مجدولاً مجدداً إلى canceled. منشور منشور مسبقاً
 * أو مسودة بلا جدولة → 409.
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { serializePost } from '@/lib/social/serialize'

const CANCELLABLE_STATUSES = new Set(['scheduled', 'failed'])

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const post = await db.socialPost.findUnique({ where: { id } })
    if (!post) return notFound('المنشور غير موجود', req.nextUrl.pathname)

    if (post.status === 'published' || post.externalId) {
      return fail(
        'CONFLICT',
        'لا يمكن إلغاء منشور منشور مسبقاً',
        409,
        { status: post.status },
        undefined,
        req.nextUrl.pathname,
      )
    }
    if (!CANCELLABLE_STATUSES.has(post.status)) {
      return fail(
        'CONFLICT',
        `لا يمكن إلغاء منشور بحالة «${post.status}» — لا توجد جدولة لإلغائها`,
        409,
        { status: post.status },
        undefined,
        req.nextUrl.pathname,
      )
    }

    const updated = await db.socialPost.update({
      where: { id },
      data: { status: 'canceled', scheduledFor: null },
    })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'cancel',
      entity: 'social_post',
      entityId: id,
      details: 'إلغاء جدولة منشور',
      request: req,
    })

    return ok(serializePost(updated as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إلغاء الجدولة للمديرين فقط')
    logger.error('[admin/social/telegram/posts/[id]/cancel POST] failed:', err)
    return internalError('تعذّر إلغاء الجدولة')
  }
}
