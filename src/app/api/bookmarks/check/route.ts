import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok, internalError, validationFail } from '@/lib/api-response'

// GET /api/bookmarks/check?modId=xxx — التحقق من حالة الحفظ
export async function GET(req: NextRequest) {
  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return ok({ bookmarked: false })
    }

    const { searchParams } = new URL(req.url)
    const modId = searchParams.get('modId')
    if (!modId) {
      return validationFail('modId is required')
    }

    const bookmark = await db.bookmark.findUnique({
      where: { userId_modId: { userId: neonUser.id, modId } },
    })

    return ok({ bookmarked: !!bookmark })
  } catch (err) {
    console.error('[bookmarks/check GET] failed:', err)
    return internalError('Failed')
  }
}
