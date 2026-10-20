import type { NextRequest } from 'next/server'
import { conflict, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { destinationReadiness } from '@/lib/telegram-destinations'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/telegram-destinations/[id]/restore — استعادة وجهة مؤرشفة.
 *
 * الطريق الصريح الوحيد للخروج من الأرشيف (PATCH يرفض أي صف مؤرشف):
 * يُفرَّغ archivedAt وتعود الحالة `pending` — لا تعود `active` مباشرة
 * أبداً، فيلزم توثيق/تفعيل متعمَّد قبل أي إرسال. تبقى غير افتراضية.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const existing = await db.telegramDestination.findUnique({ where: { id } })
    if (!existing) return notFound('الوجهة غير موجودة')
    if (!existing.archivedAt) {
      return conflict('الوجهة ليست مؤرشفة — لا حاجة للاستعادة')
    }

    const destination = await db.telegramDestination.update({
      where: { id },
      data: { archivedAt: null, status: 'pending' },
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'TELEGRAM_DESTINATION_RESTORED',
      entity: 'telegram_destination',
      entityId: id,
      details: JSON.stringify({ chatId: existing.chatId }),
      request: req,
    })

    const { verificationToken: _stripped, ...safe } = destination
    return ok({
      ...safe,
      hasVerificationToken: Boolean(destination.verificationToken),
      readiness: destinationReadiness(destination),
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations/[id]/restore POST] failed:', err)
    return internalError('Failed to restore telegram destination')
  }
}
