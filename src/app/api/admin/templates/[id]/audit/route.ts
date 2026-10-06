import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse, loadTemplateForLifecycle } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * إجراء التدقيق (#12 من 12... قائمة العمليات): كل أحداث AuditLog الخاصة
 * بهذا القالب (إنشاء/تعديل/تفعيل/إيقاف/نسخ/نشر/مجدول/ترجيع/استيراد/إرسال تجريبي)
 * الأحدث أولاً — مصدر الحقيقة لـ "ماذا تغيّر ومن غيّره".
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response

    const events = await db.auditLog.findMany({
      where: { entity: 'notification_template', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return ok({ events, total: events.length })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/audit GET] failed:', err)
    return internalError('Failed to load template audit trail')
  }
}
