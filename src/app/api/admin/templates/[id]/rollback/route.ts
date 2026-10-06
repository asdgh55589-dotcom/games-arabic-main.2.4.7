import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  authErrorResponse,
  loadTemplateForLifecycle,
  snapshotTemplateVersion,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const RollbackBodySchema = z.object({
  version: z.number().int().positive(),
})

/**
 * إجراء التراجع (#7 من 12): استعادة حقول المحتوى فقط (عنوان/متن/نص غني/
 * parseMode/المتغيرات) من لقطة إصدار غير قابلة للتعديل، مع إنشاء إصدار جديد
 * فوقه (لا تدوير للسقف) وتدقيق NOTIFICATION_TEMPLATE_ROLLED_BACK.
 * لا يمس الإرسال/التسليم (بند P2 الممنوع).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    const body = await req.json().catch(() => ({}))
    const parsed = RollbackBodySchema.safeParse(body)
    if (!parsed.success) {
      const msg = 'حدّد رقم إصدار موجباً صالحاً'
      return fail('VALIDATION_ERROR', msg, 422, { version: msg }, undefined, req.nextUrl.pathname)
    }

    const target = await db.notificationTemplateVersion.findUnique({
      where: { templateId_version: { templateId: id, version: parsed.data.version } },
    })
    if (!target) {
      return notFound('إصدار القالب غير موجود في السجل')
    }

    const updated = await db.notificationTemplate.update({
      where: { id },
      data: {
        titleTemplate: target.titleTemplate,
        bodyTemplate: target.bodyTemplate,
        richBodyTemplate: target.richBodyTemplate ?? null,
        parseMode: target.parseMode ?? null,
        variables: (target.variables ?? []) as never,
        version: template.version + 1,
      },
    })

    // لقطة صارمة: التراجع بلا سجل تاريخي يفقد معناه.
    await snapshotTemplateVersion(updated, {
      changedBy: manager.id,
      changeNote: `ترجيع إلى الإصدار ${parsed.data.version}`,
      strict: true,
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_ROLLED_BACK',
      entity: 'notification_template',
      entityId: id,
      details: JSON.stringify({
        restoredVersion: parsed.data.version,
        newVersion: updated.version,
        type: updated.type,
        channel: updated.channel,
      }),
      before: { version: template.version },
      after: { version: updated.version, restoredFrom: parsed.data.version },
      request: req,
    })

    return ok(updated)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/rollback POST] failed:', err)
    return internalError('Failed to rollback template')
  }
}
