import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { isFreeImageConfigured, uploadToFreeImage } from '@/lib/freeimage'
import { wrapImageUrl } from '@/lib/image-worker'
import { checkUploadQuota, recordUploadUsage } from '@/lib/quota'
import { reportError } from '@/lib/error-reporting'

// Owner decision (P2): unified 60MB cap for all image uploads (FreeImage real limit).
export const MAX_IMAGE_BYTES = 60 * 1024 * 1024 // 60MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']

// POST /api/storage/upload-image — creator mod images via FreeImage (server key).
// Cloudinary stays EXCLUSIVELY for avatars/user banners (untouched).
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return validationFail('يجب تسجيل الدخول')

    if (!isFreeImageConfigured()) {
      return internalError('خدمة رفع الصور غير متاحة حالياً — حاول لاحقاً')
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const modId = (formData.get('modId') as string) || undefined
    // عنوان الصورة للتسمية التلقائية (يُرسل لخدمة الرفع عند توفره)
    const rawTitle = formData.get('title')
    const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim().slice(0, 200) : undefined

    if (!file || !(file instanceof File)) {
      return validationFail('لم يتم اختيار ملف')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return validationFail('نوع الملف غير مدعوم — يُسمح بصور JPG, PNG, WebP, GIF فقط')
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return validationFail('حجم الصورة كبير جداً — الحد الأقصى 60MB (60 ميجابايت)')
    }

    // Quota gate (Arabic reason on deny).
    const check = await checkUploadQuota(user.id, user.role, file.size)
    if (!check.allowed) {
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadToFreeImage(buffer, file.type, file.name || 'image.jpg', 60_000, title)
    const wrappedUrl = wrapImageUrl(uploaded.url)

    // Record usage (always after a real provider upload — usage = reality).
    try {
      await recordUploadUsage({
        userId: user.id,
        modId,
        kind: 'image',
        provider: 'freeimage',
        originalUrl: uploaded.url,
        wrappedUrl,
        storageKey: uploaded.deleteUrl,
        bytes: file.size,
        mime: file.type,
        checksum: uploaded.sha256,
      })
    } catch (usageError) {
      console.error('[upload-image] usage record failed:', usageError)
      // Non-fatal: the upload itself succeeded; usage converges on next uploads.
    }

    return ok(
      {
        url: wrappedUrl || uploaded.url,
        originalUrl: uploaded.url,
        wrappedUrl,
        thumbUrl: uploaded.thumbUrl,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[upload-image] failed:', error)
    reportError(error, { route: 'POST /api/storage/upload-image' })
    const message = error instanceof Error ? error.message : 'فشل رفع الصورة — حاول مرة أخرى'
    if (message.includes('FREEIMAGE_API_KEY') || message.includes('غير مُكوَّن')) {
      return internalError('خدمة رفع الصور غير متاحة حالياً — حاول لاحقاً')
    }
    return internalError(message.startsWith('FreeImage') ? 'فشل رفع الصورة — حاول مرة أخرى' : message)
  }
}
