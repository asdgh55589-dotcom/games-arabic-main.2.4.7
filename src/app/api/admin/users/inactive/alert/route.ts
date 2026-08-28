import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getInactiveUsers } from '@/lib/admin/inactive-users'
import { sendInactiveUserAlert } from '@/lib/admin/send-inactive-alert'
import { ok, internalError } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { daysThreshold = 30 } = body

    const inactiveUsers = await getInactiveUsers({
      daysThreshold,
      includeWithNoActivity: false
    })

    if (inactiveUsers.length === 0) {
      return ok({ message: 'لا يوجد مستخدمون خاملون' })
    }

    await sendInactiveUserAlert({
      inactiveUsers,
      daysThreshold
    })

    return ok({
      message: `تم إرسال تنبيه لـ ${inactiveUsers.length} مستخدم خامل`
    })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
