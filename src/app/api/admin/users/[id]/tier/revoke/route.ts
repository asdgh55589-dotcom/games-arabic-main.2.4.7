import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { revokeTier } from '@/lib/tier-engine'
import { ok, internalError, notFound } from '@/lib/api-response'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const { reason } = body

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }

    await revokeTier(id, admin.id, reason)

    return ok({ message: `تم سحب ترقية ${user.username}` })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
