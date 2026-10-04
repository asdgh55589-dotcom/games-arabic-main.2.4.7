import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { forbidden, rateLimited, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { search } from '@/lib/search'

/** يحوّل خطأ صلاحيات إلى الاستجابة الصحيحة بدل 500 */
function authFail(err: unknown) {
  const status = (err as { status?: number })?.status
  if (status === 401) return unauthorized('يجب تسجيل الدخول')
  if (status === 403) return forbidden('ليس لديك صلاحية')
  return null
}

// GET /api/admin/search — بحث إداري (إدارة | admin فأعلى)
// محمي: requireAdmin + rate limit (بحث مكلف + يسجّل نشاط لكل طلب)
// ملاحظة: شكل الـ response ثابت (results/counts في الجذر) لأن
// src/app/admin/search/page.tsx يقرأ data.results مباشرة.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'admin:search' })
    if (!rl.success) {
      const res = rateLimited('محاولات بحث كثيرة — حاول بعد قليل')
      for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v)
      return res
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all'
    const platform = searchParams.get('platform') || undefined
    const status = searchParams.get('status') || undefined

    if (!q || q.trim().length < 2) {
      return NextResponse.json({
        results: [],
        counts: { mod: 0, game: 0, team: 0, user: 0 },
        total: 0,
      })
    }

    const results = await search(q, {
      type: type as any,
      platform,
      status,
    })

    await logAction({
      action: 'search',
      entity: 'system',
      details: JSON.stringify({ query: q, type, resultCount: results.total }),
      request: req,
    })

    return NextResponse.json(results)
  } catch (error) {
    logger.error('[admin/search GET]', error)
    const authResp = authFail(error)
    if (authResp) return authResp
    return NextResponse.json({ error: 'خطأ في البحث' }, { status: 500 })
  }
}
