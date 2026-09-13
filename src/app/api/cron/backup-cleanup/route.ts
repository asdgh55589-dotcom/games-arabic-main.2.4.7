import { type NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun } from '@/lib/cron-ledger'
import { cleanupOldBackups } from '@/lib/backup'

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
  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: 'duplicate' })
  }

  try {
    const deleted = await cleanupOldBackups()
    await completeRun('backup-cleanup', windowKey)
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    console.error('[backup-cleanup] فشل التنظيف:', error)
    return NextResponse.json({ error: 'فشل التنظيف' }, { status: 500 })
  }
}
