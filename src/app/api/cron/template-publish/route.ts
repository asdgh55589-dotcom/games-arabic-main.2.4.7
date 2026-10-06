import { type NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { requireCronAuth } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  declaredVariables,
  renderSampleVariables,
  snapshotExists,
  snapshotTemplateVersion,
  validateTemplateContent,
} from '@/lib/template-lifecycle'

interface PublishJobPayload {
  templateId?: string
}

/**
 * منفّذ النشر المجدول (إجراء #6 — الجانب المؤجّل):
 * يلتقط ScheduledJob entries من نوع template_publish المستحقة ويفعّل القوالب.
 * - مطالبة idempotency عبر updateMany(pending→running) فلا يُنفَّذ مرتين.
 * - بوابة التحقق نفسها قبل التفعيل — قالب غير صالح يفشل المهمة ولا يُنشر.
 * - بحد أقصى 20 مهمة لكل تشغيل (بقية المتأخرات تلتقطها النبوة التالية).
 */
async function runTemplatePublish(): Promise<NextResponse> {
  const now = new Date()
  const due = await db.scheduledJob.findMany({
    where: { type: 'template_publish', status: 'pending', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  })

  let published = 0
  let skipped = 0
  let failed = 0

  for (const job of due) {
    const claim = await db.scheduledJob.updateMany({
      where: { id: job.id, status: 'pending' },
      data: { status: 'running' },
    })
    if (claim.count === 0) continue // نافذة أخرى سبقتنا

    try {
      const payload = job.payload as PublishJobPayload
      const templateId = payload?.templateId
      if (!templateId) throw new Error('payload.templateId مفقود في مهمة النشر')

      const template = await db.notificationTemplate.findUnique({ where: { id: templateId } })
      if (!template) {
        // القالب حُذف بين الجدولة والتنفيذ — تخطٍّ مسجّل لا خطأ.
        await db.scheduledJob.update({
          where: { id: job.id },
          data: { status: 'completed', executedAt: new Date(), error: 'القالب لم يعد موجوداً' },
        })
        skipped++
        continue
      }

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
        throw new Error(`القالب غير صالح: ${firstError?.message ?? 'خطأ تحقق'}`)
      }

      const updated = await db.notificationTemplate.update({
        where: { id: templateId },
        data: { isActive: true },
      })

      if (!(await snapshotExists(templateId, updated.version))) {
        await snapshotTemplateVersion(updated, {
          changedBy: null,
          changeNote: 'نشر مجدول',
        })
      }

      await db.scheduledJob.update({
        where: { id: job.id },
        data: { status: 'completed', executedAt: new Date(), error: null },
      })

      await logAction({
        username: 'cron:template-publish',
        action: 'NOTIFICATION_TEMPLATE_PUBLISHED',
        entity: 'notification_template',
        entityId: templateId,
        details: JSON.stringify({
          jobId: job.id,
          scheduledFor: job.scheduledAt.toISOString(),
          type: updated.type,
          channel: updated.channel,
          by: 'cron',
        }),
      })

      published++
    } catch (err) {
      const message = (err as Error).message || 'فشل النشر المجدول'
      const retries = job.retries + 1
      const exhausted = retries >= job.maxRetries
      await db.scheduledJob.update({
        where: { id: job.id },
        data: {
          status: exhausted ? 'failed' : 'pending',
          retries,
          error: message,
          ...(exhausted ? { executedAt: new Date() } : {}),
        },
      })
      logger.error(`[template-publish] job ${job.id} failed:`, err)
      failed++
    }
  }

  return NextResponse.json({ ok: true, due: due.length, published, skipped, failed })
}

export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  try {
    return await runTemplatePublish()
  } catch (err) {
    logger.error('[template-publish cron] failed:', err)
    return NextResponse.json({ ok: false, error: 'template publish run failed' }, { status: 500 })
  }
}
