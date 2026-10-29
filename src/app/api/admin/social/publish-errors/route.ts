/**
 * GET /api/admin/social/publish-errors — قائمة أحداث أخطاء النشر (مرحلة 6).
 *
 * قراءة requireAdmin. فلاتر: status=open|resolved|all (الافتراضي open)،
 * scope, code — الأحدث أولاً مع إحصاء مختصر (open/آخر 24 ساعة). كل صف
 * محمول بسببه وإصلاحه عربياً (causeAr/fixAr) جاهز للعرض في مركز الأخطاء.
 */
import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse } from '@/lib/template-lifecycle'

const MAX_LIMIT = 100

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const sp = req.nextUrl.searchParams
    const status = sp.get('status') ?? 'open'
    const scope = sp.get('scope')
    const code = sp.get('code')
    const limit = Math.min(Math.max(Number(sp.get('limit')) || 50, 1), MAX_LIMIT)

    const where = {
      ...(status === 'open' ? { resolvedAt: null } : {}),
      ...(status === 'resolved' ? { resolvedAt: { not: null } } : {}),
      ...(scope ? { scope } : {}),
      ...(code ? { code } : {}),
    }

    const [items, open, last24h] = await Promise.all([
      db.publishErrorEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      }),
      db.publishErrorEvent.count({ where: { resolvedAt: null } }),
      db.publishErrorEvent.count({
        where: { resolvedAt: null, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ])

    return ok({
      items,
      counts: { open, last24h },
      limit,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — مركز الأخطاء لمشاهدة الإدارة')
    if (auth) return auth
    logger.error('[admin/social/publish-errors GET] failed:', err)
    return internalError('تعذّر تحميل الأخطاء', undefined, req.nextUrl.pathname)
  }
}

export const dynamic = 'force-dynamic'
