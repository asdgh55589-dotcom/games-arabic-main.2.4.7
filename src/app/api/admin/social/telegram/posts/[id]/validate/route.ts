/**
 * POST /api/admin/social/posts/[id]/validate — تحقق بلا كتابة.
 *
 * يستدعي `validateSocialPost` (المصدر الوحيد للقواعد) ويعيد:
 * { data: { ok, issues, metrics } } — 200 عند النجاح، 422 عند وجود مشاكل.
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { validateSocialPost } from '@/lib/social/validate-post'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireManager()
    const { id } = await ctx.params

    const post = await db.socialPost.findUnique({ where: { id } })
    if (!post) return notFound('المنشور غير موجود', req.nextUrl.pathname)

    // السماح بتجاوز مؤقت من الطلب (معاينة قبل الحفظ) — لا كتابة إطلاقاً.
    const override = await req.json().catch(() => ({}) as Record<string, unknown>)
    const body = typeof override?.body === 'string' ? override.body : post.body
    const title = typeof override?.title === 'string' ? override.title : post.title
    const parseMode =
      override && 'parseMode' in override ? (override.parseMode as string | null) : post.parseMode
    const mediaUrl =
      override && 'mediaUrl' in override ? (override.mediaUrl as string | null) : post.mediaUrl
    const richDocument =
      override && 'richDocument' in override ? override.richDocument : post.richDocument

    const result = validateSocialPost({
      title,
      body,
      parseMode,
      mediaUrl,
      richDocument,
    })

    const payload = {
      ok: result.ok,
      issues: result.issues,
      metrics: result.metrics,
    }

    if (!result.ok) {
      return fail(
        'VALIDATION_ERROR',
        'المحتوى لا يجتاز قواعد تليجرام',
        422,
        payload,
        undefined,
        req.nextUrl.pathname,
      )
    }
    return ok(payload)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — تحقق المنشورات للمديرين فقط')
    logger.error('[admin/social/posts/[id]/validate POST] failed:', err)
    return internalError('تعذّر التحقق من المنشور')
  }
}
