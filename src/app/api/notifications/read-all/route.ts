import type { NextRequest } from 'next/server'
import { fail, ok, unauthorized } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateUnreadCache } from '@/lib/notification-cache'
import { logger } from '@/lib/logger'
import { handlePrismaError } from '@/lib/prisma-errors'

async function markAllAsRead() {
  const neonUser = await getOptionalSession()
  if (!neonUser) {
    return unauthorized()
  }

  await db.notification.updateMany({
    where: { userId: neonUser.id, readAt: null },
    data: { isRead: true, readAt: new Date() },
  })

  await invalidateUnreadCache(neonUser.id)

  return ok({ success: true })
}

// POST /api/notifications/read-all — تعليم جميع الإشعارات كمقروءة
export async function POST(_req: NextRequest) {
  try {
    return await markAllAsRead()
  } catch (err) {
    logger.error('[notifications read-all POST] failed:', err)
    const { message, status, code } = handlePrismaError(err)
    return fail(code, message, status)
  }
}

// PUT /api/notifications/read-all — تعليم جميع الإشعارات كمقروءة (backwards compat)
export async function PUT() {
  try {
    return await markAllAsRead()
  } catch (err) {
    logger.error('[notifications read-all PUT] failed:', err)
    const { message, status, code } = handlePrismaError(err)
    return fail(code, message, status)
  }
}
