import type { NextRequest } from 'next/server'
import { getActivityLog } from '@/lib/admin/activity-log'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)

    const filters = {
      userId: searchParams.get('userId') || undefined,
      action: searchParams.get('action') || undefined,
      entity: searchParams.get('entity') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
    }

    const result = await getActivityLog(filters)
    return ok(result)
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
