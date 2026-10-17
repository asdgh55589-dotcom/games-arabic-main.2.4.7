/**
 * POST /api/admin/social/publish-errors/[id]/resolve — وضع علامة محلول
 * يدوياً (مرحلة 6، الفئة 7 بند 9). كتابة requireManager؛ 409 إن كان
 * محلولاً مسبقاً؛ التدقيق publish_error_resolve مع الحدث.
 */
import type { NextRequest } from 'next/server'
import { fail, internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { resolveEventManually } from '@/lib/social/publish-error-events'
import { authErrorResponse } from '@/lib/template-lifecycle'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const result = await resolveEventManually(id, {
      id: user.id,
      username: user.username,
    })

    if (result.already) {
      return fail(
        'ALREADY_RESOLVED',
        'الحدث محلول مسبقاً',
        409,
        undefined,
        undefined,
        req.nextUrl.pathname,
      )
    }

    return ok({ resolved: true })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — حل الأخطاء للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/publish-errors/[id]/resolve POST] failed:', err)
    return internalError('تعذّر تحديث الحدث', undefined, req.nextUrl.pathname)
  }
}

export const dynamic = 'force-dynamic'
