import { type NextRequest, NextResponse } from 'next/server'
import { runDailyHealthCheck } from '@/lib/image-health-check'
import { requireCronAuth } from '@/lib/cron-auth'

// محمي بـ CRON_SECRET — للاستخدام مع خدمة cron خارجية (cron-job.org)
export async function GET(req: NextRequest) {
  const authErr = await requireCronAuth(req)
  if (authErr) return authErr

  try {
    const result = await runDailyHealthCheck()
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error('[Cron] فشل فحص الصور:', error)
    return NextResponse.json({ error: 'فشل الفحص' }, { status: 500 })
  }
}
