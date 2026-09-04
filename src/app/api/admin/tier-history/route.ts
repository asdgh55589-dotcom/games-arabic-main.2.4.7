import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { okPaginated, internalError } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const skip = (page - 1) * limit

    const [history, total] = await Promise.all([
      db.tierHistory.findMany({
        include: { user: { select: { username: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.tierHistory.count(),
    ])

    return okPaginated(
      { history },
      { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    )
  } catch (err) {
    return internalError('خطأ في الخادم')
  }
}
