import type { NextRequest } from 'next/server'
import { fail, internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { PLATFORMS } from '@/lib/constants'
import { resolvePlatformRoutes } from '@/lib/social/route-resolve'
import { authErrorResponse } from '@/lib/template-lifecycle'

/**
 * GET /api/admin/social/telegram/routes/preview?platformKey=PS5
 * معاينة الاستنتاج لمنصة: «سيُنشر إلى … عبر بوت …» — بلا أي إرسال.
 * قراءة admin (تُستخدم في مصفوفة التوجيه ومعالج الجدولة لاحقاً).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const platformKey = searchParams.get('platformKey') ?? ''
    if (!platformKey) {
      const msg = 'حدّد platformKey'
      return fail('VALIDATION_ERROR', msg, 422, { platformKey: msg }, undefined, req.nextUrl.pathname)
    }
    if (!PLATFORMS.some((p) => p.key === platformKey)) {
      const msg = `منصة غير معروفة — استخدم إحدى: ${PLATFORMS.map((p) => p.key).join('، ')}`
      return fail('VALIDATION_ERROR', msg, 422, { platformKey: msg }, undefined, req.nextUrl.pathname)
    }

    const preview = await resolvePlatformRoutes(platformKey, new Date())
    return ok(preview)
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — قراءة التوجيه للمشرفين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/routes/preview GET] failed:', err)
    return internalError('Failed to preview publish routes')
  }
}
