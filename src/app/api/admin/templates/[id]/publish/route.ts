import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { conflict, fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  authErrorResponse,
  declaredVariables,
  loadTemplateForLifecycle,
  renderSampleVariables,
  snapshotExists,
  snapshotTemplateVersion,
  validateTemplateContent,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const PublishBodySchema = z.object({
  changeNote: z.string().trim().max(500).optional(),
  /** ISO-8601 مستقبلي → نشر مؤجّل عبر ScheduledJob (type=template_publish). */
  scheduledFor: z.string().optional(),
})

/**
 * إجراء النشر (#6 من 12):
 *  - فوري: تفعيل المسودة + لقطة إصدار + تدقيق NOTIFICATION_TEMPLATE_PUBLISHED.
 *  - مؤجّل: ScheduledJob بحذف نافذة idempotency + رفض 409 لو يوجد تخطيط معلّق
 *    ورفض 422 لو كان الوقت ماضياً. التنفيذ الفعلي في /api/cron/template-publish.
 * بوابة التحقق نفسها تمنع نشر قالب غير صالح (422 مع المشاكل).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    const body = await req.json().catch(() => ({}))
    const parsed = PublishBodySchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات غير صالحة — راجع الحقول المدخلة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    // بوابة النشر: قالب غير صالح لا يُنشر مطلقاً.
    const validation = validateTemplateContent({
      type: template.type,
      channel: template.channel,
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
      richBodyTemplate: template.richBodyTemplate ?? null,
      parseMode: template.parseMode ?? null,
      variables: declaredVariables(template),
      samples: renderSampleVariables(template.type),
    })
    if (!validation.ok) {
      const firstError = validation.issues.find((issue) => issue.severity === 'error')
      return fail(
        'VALIDATION_ERROR',
        firstError?.message || 'القالب غير صالح — لا يمكن نشره',
        422,
        { issues: validation.issues, metrics: validation.metrics },
        undefined,
        req.nextUrl.pathname,
      )
    }

    if (parsed.data.scheduledFor !== undefined) {
      const when = new Date(parsed.data.scheduledFor)
      if (Number.isNaN(when.getTime())) {
        const msg = 'وقت النشر غير صالح — استخدم تاريخ ISO-8601'
        return fail(
          'VALIDATION_ERROR',
          msg,
          422,
          { scheduledFor: msg },
          undefined,
          req.nextUrl.pathname,
        )
      }
      if (when.getTime() <= Date.now()) {
        const msg = 'وقت النشر يجب أن يكون في المستقبل'
        return fail(
          'VALIDATION_ERROR',
          msg,
          422,
          { scheduledFor: msg },
          undefined,
          req.nextUrl.pathname,
        )
      }

      const pending = await db.scheduledJob.findFirst({
        where: {
          type: 'template_publish',
          status: 'pending',
          windowKey: { startsWith: `template:${id}:` },
        },
      })
      if (pending) {
        return conflict('يوجد نشر مجدول لهذا القالب بالفعل — الغِه قبل جدولة آخر')
      }

      const job = await db.scheduledJob.create({
        data: {
          type: 'template_publish',
          windowKey: `template:${id}:${when.getTime()}`,
          payload: { templateId: id },
          scheduledAt: when,
          status: 'pending',
        },
      })

      await logAction({
        userId: manager.id,
        username: manager.username,
        action: 'NOTIFICATION_TEMPLATE_SCHEDULED',
        entity: 'notification_template',
        entityId: id,
        details: JSON.stringify({
          jobId: job.id,
          scheduledFor: when.toISOString(),
          type: template.type,
          channel: template.channel,
        }),
        request: req,
      })

      return ok({ scheduled: true, scheduledFor: when.toISOString(), jobId: job.id })
    }

    const updated = await db.notificationTemplate.update({
      where: { id },
      data: { isActive: true },
    })

    if (!(await snapshotExists(id, updated.version))) {
      await snapshotTemplateVersion(updated, {
        changedBy: manager.id,
        changeNote: parsed.data.changeNote ?? 'نشر القالب وتفعيله',
      })
    }

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_PUBLISHED',
      entity: 'notification_template',
      entityId: id,
      details: JSON.stringify({
        type: updated.type,
        channel: updated.channel,
        version: updated.version,
        wasActive: template.isActive,
      }),
      before: { isActive: template.isActive },
      after: { isActive: updated.isActive },
      request: req,
    })

    return ok(updated)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/publish POST] failed:', err)
    return internalError('Failed to publish template')
  }
}
