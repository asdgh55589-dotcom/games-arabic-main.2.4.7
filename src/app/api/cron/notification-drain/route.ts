import { type NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { type DrainStats, drainNotificationJobs } from '@/lib/notifications/drain'
import {
  DRAIN_DEFAULT_LIMIT,
  DRAIN_MAX_LIMIT,
  parseDrainCursor,
} from '@/lib/notifications/pipeline'

/**
 * POST/GET /api/cron/notification-drain — تصريف طابور الإشعارات (P2)
 *
 * المستهلك الوحيد لمهام `NotificationJob` (بريد + Telegram لكلا الطابورين).
 * محمي بـ CRON_SECRET عبر `requireCronAuth`.
 *
 * سجل cron المقترح (نُفِّذ خارج الكود — vercel.json غير موجود في المستودع):
 *   "crons": [{ "path": "/api/cron/notification-drain", "schedule": "* * * * *" }]
 * كل دقيقة: دفعة صغيرة تتوقف قبل مهلة الدالة، والمؤشر `nextCursor` يستأنف
 * من حيث توقفت في النداء التالي — فلا تتكرر المهام ولا تُهدر.
 */

/** مهلة الدفعة الواحدة — أقصر من مهلة الدالة الافتراضية (10 ثوانٍ). */
const BATCH_DEADLINE_MS = 7_000

/** مهلة النداء كله: نوقف الاستئناف ونترك الباقي للدورة التالية. */
const TOTAL_BUDGET_MS = 8_000

/** عدد الدفعات القصوى داخل نداء واحد (حد أقصى دفاعي). */
const MAX_BATCHES_PER_RUN = 10

function parseCount(raw: string | null, fallback: number, min: number, max: number): number {
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  const startedAt = Date.now()
  const params = req.nextUrl.searchParams
  const limit = parseCount(params.get('limit'), DRAIN_DEFAULT_LIMIT, 1, DRAIN_MAX_LIMIT)
  const maxBatches = parseCount(params.get('batches'), 1, 1, MAX_BATCHES_PER_RUN)
  let cursor = parseDrainCursor(params.get('cursor'))

  const totals: DrainStats = {
    scanned: 0,
    processed: 0,
    sent: 0,
    retried: 0,
    deferred: 0,
    skipped: 0,
    deadLettered: 0,
    hasMore: false,
    nextCursor: null,
    durationMs: 0,
  }

  let batches = 0

  try {
    for (; batches < maxBatches; batches++) {
      const elapsed = Date.now() - startedAt
      const remaining = TOTAL_BUDGET_MS - elapsed
      // لا نبدأ دفعة جديدة إن لم يتبقّ وقت كافٍ لإنهائها
      if (remaining <= 1_000) break

      const stats = await drainNotificationJobs({
        limit,
        cursor,
        deadlineMs: Math.min(BATCH_DEADLINE_MS, remaining),
      })

      totals.scanned += stats.scanned
      totals.processed += stats.processed
      totals.sent += stats.sent
      totals.retried += stats.retried
      totals.deferred += stats.deferred
      totals.skipped += stats.skipped
      totals.deadLettered += stats.deadLettered

      cursor = stats.nextCursor ? parseDrainCursor(stats.nextCursor) : null
      totals.hasMore = stats.hasMore
      totals.nextCursor = stats.nextCursor

      if (!stats.hasMore) break
    }

    totals.durationMs = Date.now() - startedAt

    logger.info({ ...totals, batches }, '[cron/notification-drain] run complete')

    return NextResponse.json(
      {
        data: {
          ...totals,
          batches,
          // التلميح لنداء الدفعة التالية عند التوقف قبل نفاد الطابور
          ...(totals.hasMore && totals.nextCursor
            ? {
                resume: `/api/cron/notification-drain?cursor=${encodeURIComponent(totals.nextCursor)}`,
              }
            : {}),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    logger.error({ err: error }, '[cron/notification-drain] run failed')
    return NextResponse.json({ error: 'فشل تصريف طابور الإشعارات' }, { status: 500 })
  }
}
