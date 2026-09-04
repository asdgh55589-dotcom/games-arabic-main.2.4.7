import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { isCloudinaryConfigured, uploadToCloudinary } from '@/lib/cloudinary'

// أنواع الصور المسموحة — صور التعديلات فقط
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const ALLOWED_IMAGE_TYPES = ['cover', 'banner', 'screenshot']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_SIZE_GALLERY = 5 * 1024 * 1024 // 5MB للمعرض

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من المصادقة — يجب أن يكون مسجل دخول
    try {
      await requireAuth()
    } catch (authErr: unknown) {
      const status = (authErr as { status?: number })?.status
      if (status === 401) {
        const { unauthorized } = await import('@/lib/api-response')
        return unauthorized('يجب تسجيل الدخول أولاً')
      }
      if (status === 403) {
        const { forbidden } = await import('@/lib/api-response')
        return forbidden('ليس لديك صلاحية رفع الصور')
      }
      throw authErr
    }

    // 2. التحقق من تهيئة Cloudinary
    if (!isCloudinaryConfigured()) {
      return internalError('خدمة رفع صور التعديلات غير متاحة حالياً — Cloudinary غير مُكوَّن')
    }

    // 3. تحليل البيانات
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const imageType = (formData.get('type') as string) || 'cover'
    const modId = (formData.get('modId') as string) || 'new'

    // 4. التحقق من الصحة — رسائل عربية
    if (!file || !(file instanceof File)) {
      return validationFail('لم يتم اختيار ملف')
    }

    // السماح أيضاً بـ image/* العامة مع فحص النوع
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return validationFail('نوع الملف غير مدعوم — يُسمح بـ JPG, PNG, WebP فقط')
    }

    const maxForType = imageType === 'screenshot' ? MAX_SIZE_GALLERY : MAX_SIZE
    if (file.size > maxForType) {
      const limitMB = Math.round(maxForType / (1024 * 1024))
      return validationFail(`حجم الملف كبير جداً — الحد الأقصى ${limitMB}MB`)
    }

    if (!ALLOWED_IMAGE_TYPES.includes(imageType)) {
      return validationFail('نوع الصورة غير صالح — يجب أن يكون cover أو banner أو screenshot')
    }

    // 5. الرفع إلى Cloudinary
    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitizedModId = modId.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50) || 'new'
    const folder = `games-arabic/mods/${sanitizedModId}/${imageType}`

    const result = await uploadToCloudinary(buffer, folder)

    // 6. تسجيل
    console.log(`[Cloudinary] تم رفع ${imageType} للتعديل ${sanitizedModId} → ${result.publicId}`)

    return ok(
      {
        url: result.secureUrl,
        publicId: result.publicId,
      },
      { status: 201 },
    )
  } catch (error) {
    // أخطاء المصادقة — نعيدها كما هي
    if (
      error instanceof Error &&
      (error.message.includes('Unauthorized') ||
        (error as unknown as { status?: number }).status === 401)
    ) {
      // دع requireAuth يعالجها — لكن هنا نعيد رسالة عربية
      return internalError('يجب تسجيل الدخول أولاً')
    }
    console.error('[Cloudinary] فشل الرفع:', error)
    const message = error instanceof Error ? error.message : 'فشل رفع الصورة — حاول مرة أخرى'
    // إذا كان الخطأ من Cloudinary غير مُكوَّن، أرسل رسالة واضحة
    if (message.includes('غير مُكوَّن')) {
      return internalError(message)
    }
    return internalError('فشل رفع الصورة — حاول مرة أخرى')
  }
}
