/**
 * GET /api/cron/social-publish — تفريغ المنشورات المجدولة المستحقة.
 *
 * يستدعيه External Scheduler (Vercel Cron / GitHub Actions) مع
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * يفعل أمرين معاً (تحديث المالك #3):
 *  1) المنشورات المستحقة في `social_posts` (status='scheduled' AND scheduled_for <= now)
 *     عبر `publishSocialPost(id, { source: 'cron' })`.
 *  2) المهام القديمة المعلّقة في `scheduled_jobs` (type='telegram_post')
 *     عبر `executeJob` — لا مستهلك لها منذ إزالة polling في Phase 7.
 *
 * Idempotency: `claimRun` + `completeRun`/`failRun` من `lib/cron-ledger.ts`.
 *
 * نستدعيها باسم **مُنscope بنافذة الدقيقة**:
 * `social-publish:<YYYY-MM-DDTHH:mm>` — فحص «أنجزت من قبل» نطاقه الدقيقة
 * نفسها: مكتمل أو جارٍ حيّ في الدقيقة ⇒ `skipped: 'duplicate'`، وصفوف
 * ميتة (فاشلة أو جارية تجاوزت عقد المطالبة) تُزاح قبل المطالبة.
 * وننظّف صفوف `social-publish:*` الأقدم من 7 أيام في كل تشغيل كي لا
 * يتضخم الجدول. يُوثَّق في docs/CRON-JOBS.md.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { executeJob } from '@/lib/scheduler'
import { publishSocialPost } from '@/lib/social/publish'

const BATCH_SIZE = 50
const LEGACY_BATCH_SIZE = 25
const LEDGER_PRUNE_DAYS = 7

/** نافذة الدقيقة الحالية بصيغة compact — تُستخدم لاسم الوظيفة وwindowKey. */
function minuteWindow(now: Date): string {
  return now.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
}

export async function GET(req: NextRequest) {
  const started = Date.now()

  const denied = await requireCronAuth(req)
  if (denied) return denied

  const now = new Date()
  const window = minuteWindow(now)
  const jobName = `social-publish:${window}`

  // ===== idempotency =====
  const claim = await claimRun(jobName, window)
  if (claim.alreadyRan) {
    return NextResponse.json(
      { ok: true, skipped: 'duplicate', window, duration_ms: Date.now() - started },
      { status: 200 },
    )
  }
  const ledgerJobId = claim.jobId

  try {
    // ===== تنظيف صفوف السجل القديمة (نفس نوع الوظيفة) =====
    const pruneBefore = new Date(now.getTime() - LEDGER_PRUNE_DAYS * 24 * 60 * 60 * 1000)
    const pruned = await db.scheduledJob.deleteMany({
      where: {
        type: { startsWith: 'social-publish:' },
        createdAt: { lt: pruneBefore },
      },
    })

    // ===== 1) منشورات Social Hub المستحقة =====
    const duePosts = await db.socialPost.findMany({
      where: {
        platform: 'telegram',
        status: 'scheduled',
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    })

    let published = 0
    let failed = 0
    let skipped = 0
    const failures: Array<{ id: string; error?: string }> = []

    for (const post of duePosts) {
      const result = await publishSocialPost(post.id, { source: 'cron' })
      if (result.status === 'published') published += 1
      else if (result.status === 'skipped') skipped += 1
      else {
        failed += 1
        failures.push({ id: post.id, error: result.error })
      }
    }

    // ===== 2) المهام القديمة (scheduled_jobs type='telegram_post') =====
    let legacyExecuted = 0
    let legacyFailed = 0
    const legacyJobs = await db.scheduledJob.findMany({
      where: {
        type: 'telegram_post',
        status: 'pending',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: LEGACY_BATCH_SIZE,
      select: { id: true },
    })

    for (const job of legacyJobs) {
      try {
        await executeJob(job.id)
        const after = await db.scheduledJob.findUnique({
          where: { id: job.id },
          select: { status: true },
        })
        if (after?.status === 'completed') legacyExecuted += 1
        else legacyFailed += 1
      } catch (err) {
        legacyFailed += 1
        logger.warn(`[social-publish] legacy job ${job.id} failed:`, err)
      }
    }

    // ===== ledger =====
    if (ledgerJobId) {
      if (failed > 0 && published === 0 && duePosts.length > 0) {
        await failRun(ledgerJobId, new Error(`${failed}/${duePosts.length} منشور فشل`))
      } else {
        await completeRun(ledgerJobId)
      }
    }

    return ok({
      window,
      published,
      failed,
      skipped,
      due: duePosts.length,
      legacy: { executed: legacyExecuted, failed: legacyFailed, found: legacyJobs.length },
      pruned: pruned.count,
      failures,
      duration_ms: Date.now() - started,
    })
  } catch (err) {
    logger.error('[cron/social-publish] failed:', err)
    if (ledgerJobId) {
      try {
        await failRun(ledgerJobId, err)
      } catch {
        // لا نُسقط الرد بسبب فشل السجل
      }
    }
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        window,
        duration_ms: Date.now() - started,
      },
      { status: 500 },
    )
  }
}
