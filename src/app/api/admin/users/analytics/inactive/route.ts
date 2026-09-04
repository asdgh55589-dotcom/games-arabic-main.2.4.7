import type { NextRequest } from 'next/server'
import { getInactiveUsers } from '@/lib/admin/inactive-users'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'

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
