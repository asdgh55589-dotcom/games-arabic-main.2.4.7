import type { NextRequest } from 'next/server'
import { internalError, ok, unauthorized } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'

async function markAllAsRead() {
  const neonUser = await getOptionalSession()
  if (!neonUser) {
    return unauthorized()
  }

  await db.notification.updateMany({
    where: { userId: neonUser.id, readAt: null },
    data: { isRead: true, readAt: new Date() },
  })

  return ok({ success: true })
}

// POST /api/notifications/read-all — تعليم جميع الإشعارات كمقروءة
export async function POST(_req: NextRequest) {
  try {
    return await markAllAsRead()
  } catch (err) {
    console.error('[notifications read-all POST] failed:', err)
    return internalError('Failed')
  }
}

// PUT /api/notifications/read-all — تعليم جميع الإشعارات كمقروءة (backwards compat)
export async function PUT() {
  try {
    return await markAllAsRead()
  } catch (err) {
    console.error('[notifications read-all PUT] failed:', err)
    return internalError('Failed')
  }
}
