import { NextRequest, NextResponse } from 'next/server'
import { runDailyHealthCheck } from '@/lib/image-health-check'

// محمي بـ CRON_SECRET — للاستخدام مع خدمة cron خارجية (cron-job.org)
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET

  // إذا لم يتم تعيين CRON_SECRET، اسمح فقط في التطوير لتسهيل الاختبار
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET غير مُكوَّن' }, { status: 500 })
    }
    // في التطوير، اسمح بدون تحقق لتسهيل الاختبار اليدوي
    console.warn('[Cron] CRON_SECRET غير مُكوَّن — السماح في وضع التطوير')
  } else if (secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDailyHealthCheck()
    return NextResponse.json({ data: result }, { status: 200 })
  } catch (error) {
    console.error('[Cron] فشل فحص الصور:', error)
    return NextResponse.json({ error: 'فشل الفحص' }, { status: 500 })
  }
}
