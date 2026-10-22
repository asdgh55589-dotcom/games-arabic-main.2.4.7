import { type NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { reconcileAllStats } from '@/lib/stats-reconcile'

/**
 * GET|POST /api/cron/reconcile-stats
 *
 * مصالحة عدّادات الإحصائيات (Mod / Game / Series) على قاعدة القاعدة:
 *   counter == baseline + COUNT(rows)
 *
 * المعامل dryRun=1 إلزامي عند التشغيل على الإنتاج: يحسب الفرق ويعرضه
 * دون كتابة أي شيء. بدونه تُطبَّق التعديلات فعلياً.
 *
 * المصادقة: Bearer <CRON_SECRET> (نفس بقية مسارات cron).
 */
export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const summary = await reconcileAllStats({ dryRun })

    logger.info(
      {
        event: 'stats_reconcile',
        dry_run: dryRun,
        modsScanned: summary.modsScanned,
        modsChanged: summary.modsChanged,
        viewsDelta: summary.viewsDelta,
        downloadsDelta: summary.downloadsDelta,
        endorsementsDelta: summary.endorsementsDelta,
        gamesChanged: summary.gamesChanged,
        seriesChanged: summary.seriesChanged,
        errors: summary.errors.length,
      },
      dryRun ? 'stats reconcile (dry run)' : 'stats reconcile applied',
    )

    return NextResponse.json(summary)
  } catch (err) {
    logger.error({ event: 'stats_reconcile_failed', dry_run: dryRun, err }, 'stats reconcile failed')
    return NextResponse.json(
      {
        dryRun,
        modsScanned: 0,
        modsChanged: 0,
        downloadsDelta: 0,
        viewsDelta: 0,
        endorsementsDelta: 0,
        gamesChanged: 0,
        seriesChanged: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      },
      { status: 500 },
    )
  }
}
