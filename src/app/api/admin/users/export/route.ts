import { type NextRequest, NextResponse } from 'next/server'
import { exportUsersToCSV, exportUsersToExcel } from '@/lib/admin/export-users'
import { internalError } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // Rate limiting: 5 requests per hour
  const rl = await rateLimit(request, { limit: 5, window: 3600, keyPrefix: 'admin:export' })
  if (!rl.success) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
    })
  }

  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'

    const filters = {
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    }

    if (format === 'excel') {
      const buffer = await exportUsersToExcel(filters)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="users.xlsx"',
        },
      })
    }

    const csv = await exportUsersToCSV(filters)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="users.csv"',
      },
    })
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
