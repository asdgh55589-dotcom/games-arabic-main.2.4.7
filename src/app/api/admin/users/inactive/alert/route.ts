import type { NextRequest } from 'next/server'
import { getInactiveUsers } from '@/lib/admin/inactive-users'
import { sendInactiveUserAlert } from '@/lib/admin/send-inactive-alert'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { daysThreshold = 30 } = body

    const inactiveUsers = await getInactiveUsers({
      daysThreshold,
      includeWithNoActivity: false,
    })

    if (inactiveUsers.length === 0) {
      return ok({ message: 'لا يوجد مستخدمون خاملون' })
    }

    await sendInactiveUserAlert({
      inactiveUsers,
      daysThreshold,
    })

    return ok({
      message: `تم إرسال تنبيه لـ ${inactiveUsers.length} مستخدم خامل`,
    })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
