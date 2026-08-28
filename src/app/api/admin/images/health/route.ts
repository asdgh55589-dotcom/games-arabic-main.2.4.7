import { NextRequest } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { getHealthStatus, runDailyHealthCheck } from '@/lib/image-health-check'
import { ok, internalError, forbidden } from '@/lib/api-response'

// GET: الحصول على حالة الصحة + السجلات + الصور المكسورة
export async function GET() {
  try {
    await requireModerator()
    const status = await getHealthStatus()
    return ok(status)
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return forbidden('ليس لديك صلاحية عرض حالة الصور')
    }
    console.error('[ImageHealth] فشل تحميل الحالة:', error)
    return internalError('فشل تحميل حالة الصور')
  }
}

// POST: تشغيل فحص اليوم يدوياً (للمسؤولين فقط)
export async function POST() {
  try {
    const user = await requireModerator()
    if (!['admin', 'owner', 'manager'].includes(user.role)) {
      return forbidden('هذه العملية متاحة للمسؤولين فقط')
    }

    const result = await runDailyHealthCheck()
    return ok(result)
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return forbidden('ليس لديك صلاحية تشغيل الفحص')
    }
    console.error('[ImageHealth] فشل الفحص اليدوي:', error)
    return internalError('فشل الفحص اليدوي — حاول مرة أخرى')
  }
}
