import { internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse } from '@/lib/template-lifecycle'

/**
 * GET /api/admin/social/telegram/bots — قائمة البوتات لمنتقيات الإسناد.
 *
 * حقول آمنة فقط (id/label/username/status) — `tokenEnc` لا يُقرأ أصلاً
 * من قاعدة البيانات هنا، فلا يمكن تسريبه في أي استجابة.
 */
export async function GET() {
  try {
    await requireManager()

    const bots = await db.socialTelegramBot.findMany({
      select: { id: true, label: true, botUsername: true, status: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })

    return ok({ bots, total: bots.length })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/bots GET] failed:', err)
    return internalError('Failed to load telegram bots')
  }
}
