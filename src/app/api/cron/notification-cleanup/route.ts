import { type NextRequest, NextResponse } from 'next/server'
import { NOTIFICATION_CONFIG } from '@/infrastructure/config/notification-config'
import { alertService, evaluateNotificationAlerts } from '@/infrastructure/observability/alerts'
import { requireCronAuth } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * تقليم سجلات الإشعارات — استدامة النموّ.
 *
 * `notification_logs` و `notification_jobs` كانا ينموان بلا حدّ: لا شيء في
 * النظام يقرأ `NOTIFICATION_CONFIG.cleanup` ولا يوجد cron يtrim. النموّ غير
 * المحدود يُبطئ استعلامات السجل والتصدير والتحليلات تدريجياً حتى يصبح
 * `GET /api/admin/notifications` و `/export` غير صالحين للاستخدام.
 *
 * نقرأ الآن `retentionDays` (90) و `jobRetentionDays` (30) من
 * `NOTIFICATION_CONFIG.cleanup` — وهو ما كان معرَّفاً وغير مقرأ.
 *
 * **لماذا دفعات محدودة (`BOUNDED`) وليست `deleteMany` بلا حدّ:**
 * `DELETE FROM notification_logs WHERE created_at < ...` على جدول كبير يفرض
 * قفلاً طويلاً على الصفوف المحذورة ويبقي `dead tuples` تحتاج `VACUUM`، وقد
 * يقطع المعاملات الطويلة على Aiven أو يستنزف connection pool. لذلك نقرأ
 * `BATCH_SIZE` معرّفات، نحذفها بـ `id: { in: ids }`، ونكرّر حتى تنفد —
 * بحلقة مُقيّدة بـ `MAX_BATCHES` حتى لو كانت البيانات فاسدة لا ينتهي التنظيف
 * أبداً في طلب واحد.
 *
 * Idempotency: الحذف بحدّ زمني متكرر آمن — تشغيل ثانٍ يجد صفوفاً أحدث ولا يفعل
 * شيئاً. لذلك لا نستخدم `claimRun`/`completeRun` هنا: `claimRun` في
 * `lib/cron-ledger.ts` يتجاهل `windowKey` تماماً ويعود `alreadyRan` بعد أول
 * تشغيل ناجح واحد فقط، فاستخدامه كان سيجعل هذا التنظيف يعمل مرة واحدة للأبد.
 *
 * المطلوب للتشغيل: أضف إلى `vercel.json` (لا يوجد الملف حالياً — انظر
 * `docs/notifications-runbook.md`) أو إلى مجدول خارجي:
 *   { "crons": [{ "path": "/api/cron/notification-cleanup", "schedule": "17 4 * * *" }] }
 * كل طلب يجب أن يحمل `Authorization: Bearer $CRON_SECRET`.
 */

/** حجم الدفعة الواحدة. صغير بما يكفي ليبقى كل `DELETE` قصيراً. */
const BATCH_SIZE = 500

/** سقف الدفعات في التشغيل الواحد — يمنع حلقة لا نهائية. */
const MAX_BATCHES = 40

interface DeletionResult {
  deleted: number
  batches: number
  /** هل بلغنا سقف الدفعات وما زالت صفوف أقدم من الحد موجودة؟ */
  truncated: boolean
}

/**
 * يحذف صفوفاً أقدم من `cutoff` على دفعات محدودة.
 * `model` هو اسم Prisma model ('notificationLog' | 'notificationJob').
 */
async function deleteOlderThanBatched(
  model: 'notificationLog' | 'notificationJob',
  where: Record<string, unknown>,
  batchSize = BATCH_SIZE,
  maxBatches = MAX_BATCHES,
): Promise<DeletionResult> {
  const result: DeletionResult = { deleted: 0, batches: 0, truncated: false }

  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await (
      db[model] as {
        findMany: (args: unknown) => Promise<Array<{ id: string }>>
      }
    ).findMany({ where, select: { id: true }, take: batchSize })

    if (rows.length === 0) return result

    const ids = rows.map((row) => row.id)

    // حذف مُقيّد بالمعرّفات التي قرأناها للتو — لا يُمسّ صف ظهر بعد القراءة.
    const deletion = await (
      db[model] as {
        deleteMany: (args: unknown) => Promise<{ count: number }>
      }
    ).deleteMany({ where: { id: { in: ids } } })

    result.deleted += deletion.count
    result.batches += 1

    // دفعة جزئية تعني أن `deleteMany` اصطدم بشيء (صف محذوف بالتوازي مثلاً).
    // نكمل فقط إن حُذفت الدفعة كاملة، وإلا فقد نعلّق.
    if (deletion.count < ids.length) return result

    if (rows.length < batchSize) return result
  }

  // بلوغ السقف: صفوف أقدم من الحد ما زالت موجودة — التشغيل التالي يكملها.
  result.truncated = true
  return result
}

export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  const { retentionDays, jobRetentionDays } = NOTIFICATION_CONFIG.cleanup

  // مبني على UTC: التواريخ تُقارن مع `now` في SQL.
  const now = Date.now()
  const logCutoff = new Date(now - retentionDays * 86_400_000)
  const jobCutoff = new Date(now - jobRetentionDays * 86_400_000)

  try {
    const logs = await deleteOlderThanBatched('notificationLog', { createdAt: { lt: logCutoff } })
    const jobs = await deleteOlderThanBatched('notificationJob', { updatedAt: { lt: jobCutoff } })

    // مراقبة: نفس النافذة التي نظّفنا للتو تُقرأ للحكم على صحة التوصيل.
    // ملاحظة: مهام `dead_letter` تخضع لنفس الاحتفاظ (30 يوماً) — أي أن نافذة
    // إعادة الإرسال اليدوي عبر `/api/admin/notifications/retry` محدودة بـ 30 يوماً
    // من آخر تحديث للمهمة. إن أردنا إبقاء أدلة الفشل فترات أطول، ذلك تغيير
    // سياسة احتفاظ لا تغيير هنا.
    const [deadLetterCount, windowTotal, windowFailed] = await Promise.all([
      db.notificationJob.count({ where: { status: 'dead_letter' } }),
      db.notificationJob.count({
        where: {
          updatedAt: { gte: new Date(now - 24 * 3_600_000) },
          status: { in: ['sent', 'failed'] },
        },
      }),
      db.notificationJob.count({
        where: {
          updatedAt: { gte: new Date(now - 24 * 3_600_000) },
          status: 'failed',
        },
      }),
    ])

    // `fire` صامت ولا يرمي أبداً. ننتظره هنا داخل cron حتى لا تخرج العملية
    // قبل تسجيل التنبيه وتوصيله إلى الـ webhook.
    const alerts = evaluateNotificationAlerts({ deadLetterCount, windowTotal, windowFailed })
    for (const alert of alerts) {
      await alertService.fire(alert)
    }

    logger.info(
      {
        retentionDays,
        jobRetentionDays,
        logCutoff: logCutoff.toISOString(),
        jobCutoff: jobCutoff.toISOString(),
        logsDeleted: logs.deleted,
        jobsDeleted: jobs.deleted,
        deadLetterCount,
        windowTotal,
        windowFailed,
        alerts: alerts.map((a) => a.name),
      },
      '[notification-cleanup] اكتمل التقليم',
    )

    return NextResponse.json({
      ok: true,
      retention: { logDays: retentionDays, jobDays: jobRetentionDays },
      cutoffs: { logs: logCutoff.toISOString(), jobs: jobCutoff.toISOString() },
      deleted: { notificationLogs: logs, notificationJobs: jobs },
      health: { deadLetterCount, windowTotal, windowFailed },
      alertsFired: alerts.map((a) => a.name),
    })
  } catch (error) {
    logger.error('[notification-cleanup] فشل التقليم:', error)
    return NextResponse.json({ error: 'فشل تقليم سجلات الإشعارات' }, { status: 500 })
  }
}
