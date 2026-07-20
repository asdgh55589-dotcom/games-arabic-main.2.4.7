import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getInactiveUsers } from '@/lib/admin/inactive-users'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const daysThreshold = parseInt(searchParams.get('daysThreshold') || '30', 10)

    const inactiveUsers = await getInactiveUsers({
      daysThreshold,
      includeWithNoActivity: false
    })

    return NextResponse.json({ inactiveUsers })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status })
  }
}
