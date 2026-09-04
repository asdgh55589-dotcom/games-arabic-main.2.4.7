import { v2 as cloudinary } from 'cloudinary'

// تهيئة Cloudinary — يتم التهيئة فقط عند توفر بيانات الاعتماد
// يدعم كلاً من المتغيرات الثلاثة المنفصلة أو CLOUDINARY_URL الموحد
if (process.env.CLOUDINARY_URL) {
  // SDK يقرأ CLOUDINARY_URL تلقائياً، لكن نضبطه صراحة للتأكد
  // صيغة: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
} else if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

export function isCloudinaryConfigured(): boolean {
  return !!(
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET) ||
    process.env.CLOUDINARY_URL
  )
}

// رفع صورة إلى Cloudinary — مخصص لصور التعديلات فقط (cover, banner, screenshots)
// الصور الشخصية وخلفيات المستخدمين تبقى على Supabase Storage
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<{ url: string; publicId: string; secureUrl: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary غير مُكوَّن — أضف بيانات الاعتماد في ملف .env')
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        // تحسين تلقائي: WebP/AVIF حسب المتصفح
        format: 'auto',
        quality: 'auto',
        // نسخ احتياطي للاستعادة
        backup: true,
      },
      (error, result) => {
        if (error) reject(error)
        else if (result) {
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
          })
        } else {
          reject(new Error('فشل الرفع إلى Cloudinary'))
        }
      },
    )
    uploadStream.end(fileBuffer)
  })
}

// حذف صورة من Cloudinary
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured()) return
  await cloudinary.uploader.destroy(publicId)
}

// إحصائيات الاستخدام
export async function getCloudinaryUsage(): Promise<{
  usage: number
  limit: number
  percentUsed: number
}> {
  if (!isCloudinaryConfigured()) {
    return { usage: 0, limit: 25 * 1024 * 1024 * 1024, percentUsed: 0 }
  }
  try {
    const usage = await cloudinary.api.usage()
    const limit = 25 * 1024 * 1024 * 1024 // 25GB باقة مجانية
    return {
      usage: usage.storage?.usage || 0,
      limit,
      percentUsed: ((usage.storage?.usage || 0) / limit) * 100,
    }
  } catch {
    return { usage: 0, limit: 25 * 1024 * 1024 * 1024, percentUsed: 0 }
  }
}

export { cloudinary }
