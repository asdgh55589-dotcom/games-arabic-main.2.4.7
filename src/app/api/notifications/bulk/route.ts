import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok, unauthorized, validationFail, internalError } from '@/lib/api-response'

async function requireUser() {
  return getOptionalSession()
}

// DELETE /api/notifications/bulk — حذف عدة إشعارات دفعة واحدة
export async function DELETE(req: NextRequest) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return unauthorized()
    }

    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return validationFail('ids array required')
    }

    const deleted = await db.notification.deleteMany({
      where: {
        id: { in: ids },
        userId: neonUser.id,
      },
    })

    return ok({ deleted: deleted.count })
  } catch (err) {
    console.error('[notifications bulk DELETE] failed:', err)
    return internalError('Failed')
  }
}
