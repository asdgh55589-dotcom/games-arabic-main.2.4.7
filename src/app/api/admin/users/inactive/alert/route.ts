import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getInactiveUsers } from '@/lib/admin/inactive-users'
import { sendInactiveUserAlert } from '@/lib/admin/send-inactive-alert'

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
      return NextResponse.json({ message: 'لا يوجد مستخدمون خاملون' })
    }

    await sendInactiveUserAlert({
      inactiveUsers,
      daysThreshold
    })

    return NextResponse.json({
      message: `تم إرسال تنبيه لـ ${inactiveUsers.length} مستخدم خامل`
    })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
