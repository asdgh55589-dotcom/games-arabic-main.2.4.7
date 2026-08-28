import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { NotificationType } from '@/lib/notifications/types'
import { getOptionalSession } from '@/lib/auth'
import { ok, okPaginatedWithMeta, unauthorized, validationFail, internalError } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'

// GET /api/notifications — قائمة الإشعارات
export async function GET(req: NextRequest) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized()
    }

    const { searchParams } = new URL(req.url)
    const { page, limit } = parsePagination(
      searchParams.get('page'),
      searchParams.get('limit'),
      { limit: 20, maxLimit: 50 }
    )
    const type = searchParams.get('type')
    const read = searchParams.get('read')

    const where: Record<string, unknown> = { userId: user.id }
    if (type && type !== 'all') where.type = type
    if (read === 'true') where.readAt = { not: null }
    if (read === 'false') where.readAt = null

    const [total, unreadCount, rawNotifications] = await Promise.all([
      db.notification.count({ where }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          data: true,
          readAt: true,
          createdAt: true,
          actor: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      }),
    ])

    const notifications = rawNotifications.map((n) => ({
      ...n,
      actor: n.actor || null,
      link: (n.data as any)?.link || null,
    }))

    return okPaginatedWithMeta(notifications, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    }, { unreadCount })
  } catch (err) {
    console.error('[notifications GET] failed:', err)
    return internalError('Failed to fetch notifications')
  }
}

// POST /api/notifications — إنشاء إشعار جديد
// ملاحظة: الإشعارات تُنشأ عبر NotificationService في الحالات الآلية
// هذا المسار محمي بمصادقة + whitelist للأنواع
const ALLOWED_NOTIFICATION_TYPES = new Set([
  NotificationType.CommentReply,
  NotificationType.ModEndorse,
  NotificationType.ModEndorseMilestone,
  NotificationType.ModFeatured,
  NotificationType.TierUpgrade,
  NotificationType.SpecialRoleAssigned,
  NotificationType.SpecialRoleRemoved,
  NotificationType.AdminAction,
])

export async function POST(req: NextRequest) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized()
    }

    const body = await req.json()
    const { type, title, message, data } = body

    if (!type || !title || !message) {
      return validationFail({ missing: ['type', 'title', 'message'].filter(f => !body[f]) })
    }

    // التحقق من أن النوع مسموح به
    if (!ALLOWED_NOTIFICATION_TYPES.has(type)) {
      return validationFail({ type: 'Invalid notification type' })
    }

    const notification = await db.notification.create({
      data: {
        userId: user.id,
        type,
        title,
        message,
        data: data ?? undefined,
      },
    })

    return ok(notification)
  } catch (err) {
    console.error('[notifications POST] failed:', err)
    return internalError('Failed to create notification')
  }
}
