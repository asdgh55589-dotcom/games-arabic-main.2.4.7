import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { upgradeUser } from '@/lib/tier-engine'
import { ok, internalError, notFound, validationFail } from '@/lib/api-response'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const { tier, notes } = body

    if (typeof tier !== 'number' || tier < 0 || tier > 5) {
      return validationFail({ message: 'مستوى غير صالح' })
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }

    await upgradeUser(id, tier, 'admin', admin.id, notes)

    return ok({ message: `تم ترقية ${user.username} إلى المستوى ${tier}` })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
