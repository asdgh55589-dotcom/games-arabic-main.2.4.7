/**
 * POST/GET /api/cron/publish-digest — التقرير الدوري للنشر (مرحلة 6، الفئة 7
 * بند 13). محمي بـ CRON_SECRET عبر `requireCronAuth`.
 *
 * ?type=daily (افتراضي) — آخر 24 ساعة، بادئة "اليوم".
 * ?type=weekly — آخر 7 أيام، بادئة "الأسبوع الماضي".
 *
 * يجمع: عدد تسليمات النشر الناجحة والفاشلة (social_post_deliveries)،
 * أرشيفات المنشورات (social_posts.archived_at)، الأخطاء المفتوحة
 * (publish_error_events) — ثم يرسل PublishDigest (InApp + Email) لكل
 * مدير محتوى عبر NotificationService الحالي.
 *
 * Idempotency: claimRun `publish-digest:<type>` على نافذة يومية/أسبوعية —
 * النداء المكرر لنفس النافذة يُتخطى (skipped=duplicate).
 *
 * سجل cron المقترح (نُفِّذ خارج الكود — vercel.json غير موجود):
 *   { "path": "/api/cron/publish-digest?type=daily",  "schedule": "0 5 * * *" }
 *   { "path": "/api/cron/publish-digest?type=weekly", "schedule": "0 5 * * 6" }
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { contentManagers, sendToService } from '@/lib/social/publish-error-events'

export const dynamic = 'force-dynamic'

/** مفتاح النافذة — يومي: التاريخ الحالي؛ أسبوعي: تاريخ بداية الأسبوع. */
function windowKey(now: Date, type: 'daily' | 'weekly'): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (type === 'daily') {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const denied = await requireCronAuth(req)
  if (denied) return denied

  const started = Date.now()
  const sp = req.nextUrl.searchParams
  const rawType = sp.get('type') === 'weekly' ? 'weekly' : 'daily'
  const key = windowKey(new Date(), rawType)
  const jobName = `publish-digest:${rawType}`

  const claim = await claimRun(jobName, key)
  if (claim.alreadyRan) {
    return NextResponse.json(
      { ok: true, skipped: 'duplicate', type: rawType, window: key },
      { status: 200 },
    )
  }
  const ledgerJobId = claim.jobId ?? ''

  try {
    const since = new Date(Date.now() - (rawType === 'daily' ? 24 : 7 * 24) * 60 * 60 * 1000)
    const until = new Date()

    const [delivered, failed, archived, openErrors, managers] = await Promise.all([
      db.socialPostDelivery.count({
        where: { status: 'sent', createdAt: { gte: since, lte: until } },
      }),
      db.socialPostDelivery.count({
        where: { status: 'failed', createdAt: { gte: since, lte: until } },
      }),
      db.socialPost.count({
        where: { archivedAt: { gte: since, lte: until } },
      }),
      db.publishErrorEvent.count({ where: { resolvedAt: null } }),
      contentManagers(),
    ])

    const periodLabel = rawType === 'daily' ? 'اليوم' : 'الأسبوع الماضي'
    let notified = 0
    for (const manager of managers) {
      await sendToService({
        userId: manager.id,
        type: 'PublishDigest',
        channels: ['InApp', 'Email'],
        templateVariables: {
          publishedCount: delivered,
          failedCount: failed,
          archivedCount: archived,
          openErrors,
          periodLabel,
        },
      })
      notified += 1
    }

    await completeRun(ledgerJobId)
    logger.info(
      `[publish-digest] ${rawType}: delivered=${delivered} failed=${failed} archived=${archived} openErrors=${openErrors} notified=${notified}`,
    )

    return NextResponse.json(
      {
        ok: true,
        type: rawType,
        window: { since: since.toISOString(), until: until.toISOString() },
        counts: { delivered, failed, archived, openErrors },
        notified,
        duration_ms: Date.now() - started,
      },
      { status: 200 },
    )
  } catch (err) {
    try {
      await failRun(ledgerJobId, err)
    } catch (ledgerErr) {
      logger.warn('[publish-digest] failRun failed:', ledgerErr)
    }
    logger.error('[publish-digest] digest failed:', err)
    return NextResponse.json({ ok: false, error: 'تعذّر إعداد التقرير الدوري' }, { status: 500 })
  }
}
