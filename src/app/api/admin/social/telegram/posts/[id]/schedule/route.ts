/**
 * POST /api/admin/social/telegram/posts/[id]/schedule — جدولة مستقبلية.
 *
 * body: { scheduledFor: ISO string }. المرفوض: ماضٍ (422)، ومنشور
 * منشور مسبقاً (409). يعيد status='scheduled'.
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ScheduleSchema } from '@/lib/social/post-schemas'
import { serializePost } from '@/lib/social/serialize'

const SCHEDULABLE_STATUSES = new Set(['draft', 'scheduled', 'failed', 'canceled'])

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const post = await db.socialPost.findUnique({ where: { id } })
    if (!post) return notFound('المنشور غير موجود', req.nextUrl.pathname)

    if (post.status === 'published' || post.externalId) {
      return fail(
        'CONFLICT',
        'لا يمكن جدولة منشور منشور مسبقاً',
        409,
        { status: post.status },
        undefined,
        req.nextUrl.pathname,
      )
    }
    if (!SCHEDULABLE_STATUSES.has(post.status)) {
      return fail(
        'CONFLICT',
        `لا يمكن جدولة منشور بحالة «${post.status}»`,
        409,
        { status: post.status },
        undefined,
        req.nextUrl.pathname,
      )
    }

    const body = await req.json().catch(() => null)
    const parsed = ScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return fail(
        'VALIDATION_ERROR',
        'موعد الجدولة مطلوب بصيغة تاريخ صالحة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const { scheduledFor } = parsed.data
    const now = new Date()
    if (scheduledFor.getTime() <= now.getTime()) {
      return fail(
        'VALIDATION_ERROR',
        'موعد الجدولة يجب أن يكون في المستقبل',
        422,
        { scheduledFor: 'الموعد في الماضي' },
        undefined,
        req.nextUrl.pathname,
      )
    }

    const updated = await db.socialPost.update({
      where: { id },
      data: { status: 'scheduled', scheduledFor, lastError: null },
    })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'schedule',
      entity: 'social_post',
      entityId: id,
      details: `جدولة منشور حتى ${scheduledFor.toISOString()}`,
      request: req,
    })

    return ok(serializePost(updated as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — جدولة المنشورات للمديرين فقط')
    logger.error('[admin/social/telegram/posts/[id]/schedule POST] failed:', err)
    return internalError('تعذّر جدولة المنشور')
  }
}
