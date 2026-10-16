import { type NextRequest, NextResponse } from 'next/server'
import { cleanupOldBackups } from '@/lib/backup'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { logger } from '@/lib/logger'

/**
 * إزالة النسخ الاحتياطية القديمة.
 * يُنفَّذ مرة واحدة يوميًا عبر cron.
 */
export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const windowKey = today

  const claimed = await claimRun('backup-cleanup', windowKey)
  if (claimed.alreadyRan) {
    return NextResponse.json({ ok: true, skipped: 'duplicate' })
  }

  const jobId = claimed.jobId

  try {
    const deleted = await cleanupOldBackups()
    if (jobId) await completeRun(jobId)
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    logger.error('[backup-cleanup] فشل التنظيف:', error)
    // تحرير النافذة: بلا failRun يبقى الصف running ويحجب كل ticks اليوم.
    if (jobId) {
      try {
        await failRun(jobId, error)
      } catch {
        // لا نُسقط رد الخطأ الأصلي بسبب فشل السجل
      }
    }
    return NextResponse.json({ error: 'فشل التنظيف' }, { status: 500 })
  }
}
