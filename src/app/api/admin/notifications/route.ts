import { type NextRequest, NextResponse } from 'next/server'
import { forbidden, internalError, unauthorized } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const channel = searchParams.get('channel') || undefined
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined

    const where: Record<string, unknown> = {}

    if (channel) (where as Record<string, unknown>).channel = channel
    if (status) (where as Record<string, unknown>).status = status
    if (type) {
      ;(where as Record<string, unknown>).notification = { type }
    }

    const [logs, total] = await Promise.all([
      db.notificationLog.findMany({
        where,
        include: {
          notification: {
            include: {
              user: { select: { id: true, username: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notificationLog.count({ where }),
    ])

    return NextResponse.json({
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — هذه الصفحة للمشرفين فقط')
    logger.error({ err: error, route: 'GET /api/admin/notifications' }, 'Failed to load notification logs')
    return internalError('فشل تحميل سجل الإشعارات')
  }
}
