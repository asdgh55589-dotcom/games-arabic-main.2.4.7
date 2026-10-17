/**
 * GET /api/cron/social-publish — تفريغ المنشورات المجدولة المستحقة.
 *
 * يستدعيه External Scheduler (Vercel Cron / GitHub Actions) مع
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * يفعل أمرين معاً (تحديث المالك #3):
 *  1) المنشورات المستحقة في `social_posts` (status='scheduled' AND scheduled_for <= now)
 *     — ذات الأهداف عبر `publishSocialPostMulti`، وبلا أهداف عبر
 *     `publishSocialPost` القديم (توافق).
 *  2) المهام القديمة المعلّقة في `scheduled_jobs` (type='telegram_post')
 *     عبر `executeJob` — لا مستهلك لها منذ إزالة polling في Phase 7.
 *
 * المرحلة 4: بعد التفريغ تُطابَق المشاريع المرتبطة (`postId`) وتُكمل
 * جانبها الاجتماعي — نفس `SocialScheduleProject` الذي يقرؤه كرون
 * الموقع، مصدر حقيقة واحد.
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
import { completeProjectSide } from '@/lib/schedule-projects'
import { executeJob } from '@/lib/scheduler'
import { publishSocialPost } from '@/lib/social/publish'
import { publishSocialPostMulti } from '@/lib/social/publish-multi'

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
    // المؤرشف (archivedAt != null) مستثنى — الأرشفة توقف الجدولة أيضاً.
    const duePosts = await db.socialPost.findMany({
      where: {
        platform: 'telegram',
        status: 'scheduled',
        archivedAt: null,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, targets: { select: { id: true }, take: 1 } },
    })

    let published = 0
    let failed = 0
    let skipped = 0
    const failures: Array<{ id: string; error?: string }> = []
    const publishedIds: string[] = []
    const failedIds: string[] = []

    for (const post of duePosts) {
      // ذات الأهداف ← المحرك المتعدد؛ بلا أهداف ← المسار الأحادي (توافق).
      if ((post.targets ?? []).length > 0) {
        const multi = await publishSocialPostMulti(post.id, { source: 'cron' })
        published += multi.published
        failed += multi.failed
        skipped += multi.skipped
        if (multi.published > 0) publishedIds.push(post.id)
        if (multi.failed > 0) {
          failedIds.push(post.id)
          failures.push({
            id: post.id,
            error: multi.error ?? multi.targets.find((t) => t.error)?.error,
          })
        }
      } else {
        const result = await publishSocialPost(post.id, { source: 'cron' })
        if (result.status === 'published') {
          published += 1
          publishedIds.push(post.id)
        } else if (result.status === 'skipped') skipped += 1
        else {
          failed += 1
          failedIds.push(post.id)
          failures.push({ id: post.id, error: result.error })
        }
      }
    }

    // ===== 1ب) مطابقة مشاريع الجدولة المرتبطة (الجانب الاجتماعي) =====
    let projectsReconciled = 0
    const firedIds = [...publishedIds, ...failedIds]
    if (firedIds.length > 0) {
      const linked = await db.socialScheduleProject.findMany({
        where: { postId: { in: firedIds }, status: { in: ['scheduled', 'running'] } },
        select: { id: true, postId: true },
      })
      const failedSet = new Set(failedIds)
      const failureById = new Map(failures.map((f) => [f.id, f.error ?? 'فشل النشر'] as const))
      for (const project of linked) {
        if (!project.postId) continue
        if (failedSet.has(project.postId)) {
          // فشل طرفي فقط إن استنفد المنشور (وإلا ما يزال مجدولاً للمحاولة).
          const postRow = await db.socialPost.findUnique({
            where: { id: project.postId },
            select: { status: true },
          })
          if (postRow?.status === 'failed') {
            await completeProjectSide(project.id, 'social', failureById.get(project.postId))
            projectsReconciled += 1
          }
        } else {
          await completeProjectSide(project.id, 'social')
          projectsReconciled += 1
        }
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
      projects: projectsReconciled,
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
