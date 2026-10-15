/**
 * POST /api/admin/social/telegram/posts/[id]/publish — نشر فوري.
 *
 * يستدعي `publishSocialPost` (المسار الوحيد للنشر). لا يرمي 500 على فشل
 * تليجرام — يعيد 422 مع `reason` كي يعرض المحرّر سبباً عربياً.
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { publishSocialPost } from '@/lib/social/publish'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const post = await db.socialPost.findUnique({ where: { id }, select: { id: true } })
    if (!post) return notFound('المنشور غير موجود', req.nextUrl.pathname)

    const result = await publishSocialPost(id, {
      source: 'manual',
      actor: { id: user.id, username: user.username },
    })

    if (result.status === 'skipped') {
      return ok({ status: 'skipped', reason: result.reason, externalId: result.externalId ?? null })
    }
    if (!result.ok) {
      return fail(
        'PUBLISH_FAILED',
        result.error ?? 'فشل النشر',
        422,
        {
          status: 'failed',
          reason: result.reason,
          externalId: result.externalId ?? null,
        },
        undefined,
        req.nextUrl.pathname,
      )
    }

    return ok({ status: 'published', externalId: result.externalId ?? null })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — نشر المنشورات للمديرين فقط')
    logger.error('[admin/social/telegram/posts/[id]/publish POST] failed:', err)
    return internalError('تعذّر نشر المنشور')
  }
}
