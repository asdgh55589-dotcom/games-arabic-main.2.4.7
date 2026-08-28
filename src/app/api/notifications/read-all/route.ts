import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok, unauthorized, internalError } from '@/lib/api-response'

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
