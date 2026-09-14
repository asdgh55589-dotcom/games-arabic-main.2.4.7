import type { NextRequest } from 'next/server'
import { forbidden, internalError, okPaginated, unauthorized } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { adminListComments } from '@/lib/comments/repository'

/** يحوّل خطأ صلاحيات إلى الاستجابة الصحيحة بدل 500 */
function authFail(err: unknown) {
  // duck-typing على status (يعمل مع AuthError ومع أي كائن خطأ يحمل status)
  const status = (err as { status?: number })?.status
  if (status === 401) return unauthorized('يجب تسجيل الدخول')
  if (status === 403) return forbidden('ليس لديك صلاحية')
  return null
}

// GET /api/admin/comments — جلب التعليقات (للإدارة)
export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')))

    const { comments, total } = await adminListComments({ search, page, limit })
    return okPaginated(comments, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[admin/comments GET] failed:', err)
    return authFail(err) ?? internalError('فشل العملية')
  }
}

// NOTE: حذف via DELETE /api/admin/comments/[id] فقط — نسخة ?id= حُذفت (مكررة).
