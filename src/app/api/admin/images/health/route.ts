import { NextRequest } from 'next/server'
import { forbidden, internalError, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { getCloudinaryUsage } from '@/lib/cloudinary'
import { getHealthStatus, runDailyHealthCheck } from '@/lib/image-health-check'

// GET: الحصول على حالة الصحة + السجلات + الصور المكسورة + حالة المزودين (P3)
export async function GET() {
  try {
    await requireModerator()
    const [status, providers] = await Promise.all([getHealthStatus(), getProvidersHealth()])
    return ok({ ...status, providers })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return forbidden('ليس لديك صلاحية عرض حالة الصور')
    }
    console.error('[ImageHealth] فشل تحميل الحالة:', error)
    return internalError('فشل تحميل حالة الصور')
  }
}

/**
 * Per-provider rollup (P3). Supabase-direct uploads don't write UploadAsset
 * rows, so Supabase is reported as untracked rather than fabricated.
 */
async function getProvidersHealth() {
  const [freeimage, ia, cloudinary] = await Promise.all([
    db.uploadAsset.aggregate({
      where: { provider: 'freeimage' },
      _count: true,
      _sum: { bytes: true },
    }).catch(() => null),
    db.uploadAsset.aggregate({
      where: { provider: 'ia' },
      _count: true,
      _sum: { bytes: true },
    }).catch(() => null),
    getCloudinaryUsage().catch(() => null),
  ])

  const cloudinaryIssue =
    !cloudinary || cloudinary.usage < 0
      ? 'غير متاح — تحقق من إعدادات Cloudinary'
      : cloudinary.percentUsed >= 90
        ? `الاستخدام مرتفع (${cloudinary.percentUsed}%)`
        : null

  return {
    cloudinary: {
      status: cloudinaryIssue ? 'issue' : 'ok',
      issue: cloudinaryIssue,
      usage: cloudinary && cloudinary.usage >= 0 ? cloudinary.usage : null,
      limit: cloudinary && cloudinary.limit >= 0 ? cloudinary.limit : null,
      percentUsed: cloudinary && cloudinary.percentUsed >= 0 ? cloudinary.percentUsed : null,
    },
    freeimage: {
      status: freeimage ? 'ok' : 'issue',
      issue: freeimage ? null : 'تعذر قراءة سجلات الرفع',
      uploads: freeimage?._count ?? 0,
      bytes: Number(freeimage?._sum.bytes ?? 0),
    },
    ia: {
      status: ia ? 'ok' : 'issue',
      issue: ia ? null : 'تعذر قراءة سجلات الرفع',
      files: ia?._count ?? 0,
      bytes: Number(ia?._sum.bytes ?? 0),
    },
    supabase: {
      status: 'untracked',
      issue: 'الرفع المباشر لا يسجل صفوف UploadAsset — راجع سياسات الـ buckets',
      uploads: null,
      bytes: null,
    },
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
