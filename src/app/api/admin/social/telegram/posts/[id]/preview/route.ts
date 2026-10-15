/**
 * POST /api/admin/social/posts/[id]/preview — معاينة بلا إرسال.
 *
 * يعيد:
 * { data: { text, parseMode, photo?, chunks, rich? } }
 * لا ي呼叫 Telegram ولا يكتب في قاعدة البيانات.
 */
import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
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

    // تجاوز مؤقت من الطلب (معاينة قبل الحفظ) — لا كتابة إطلاقاً.
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

    // المعاينة تُعاد دائماً (حتى مع مشاكل) كي يعرضها المحرّر مع قائمتها.
    return ok({
      text: result.preview.text,
      parseMode: result.preview.parseMode,
      photo: result.preview.photo,
      chunks: result.preview.chunks,
      rich: result.preview.rich ?? null,
      ok: result.ok,
      issues: result.issues,
      metrics: result.metrics,
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — معاينة المنشورات للمديرين فقط')
    logger.error('[admin/social/posts/[id]/preview POST] failed:', err)
    return internalError('تعذّر بناء معاينة المنشور')
  }
}
