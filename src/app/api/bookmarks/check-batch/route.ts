import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/bookmarks/check-batch — التحقق من حالة الحفظ لعدة تعريبات في طلب واحد
export async function POST(req: NextRequest) {
  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return ok({ bookmarkedIds: [] })
    }

    const body = await req.json().catch(() => ({}))
    const modIds: string[] = Array.isArray(body.modIds) ? body.modIds : []
    if (modIds.length === 0) {
      return ok({ bookmarkedIds: [] })
    }

    // طلب واحد لجلب كل الـ bookmarks
    const bookmarks = await db.bookmark.findMany({
      where: {
        userId: neonUser.id,
        modId: { in: modIds },
      },
      select: { modId: true },
    })

    return ok({ bookmarkedIds: bookmarks.map((b) => b.modId) })
  } catch (err) {
    console.error('[bookmarks/check-batch POST] failed:', err)
    return internalError('Failed')
  }
}
