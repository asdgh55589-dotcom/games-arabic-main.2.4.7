import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getInactiveUsers } from '@/lib/admin/inactive-users'
import { ok, internalError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const daysThreshold = parseInt(searchParams.get('daysThreshold') || '30', 10)

    const inactiveUsers = await getInactiveUsers({
      daysThreshold,
      includeWithNoActivity: false,
    })

    return ok({ inactiveUsers })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
