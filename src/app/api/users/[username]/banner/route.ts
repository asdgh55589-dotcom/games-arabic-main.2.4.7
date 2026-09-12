import type { NextRequest } from 'next/server'
import {
  fail,
  forbidden,
  internalError,
  ok,
  rateLimited,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import * as cloudinaryLib from '@/lib/cloudinary'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

type CloudinarySA1 = {
  uploadToCloudinary: (
    buffer: Buffer,
    opts: { folder: string; transform?: string; publicId?: string },
  ) => Promise<{ url: string; publicId: string }>
  deleteFromCloudinary: (publicId: string) => Promise<{ ok: boolean }>
  isCloudinaryEnabled: () => boolean
  checkAvatarQuota: (
    userId: string,
    bytes: number,
  ) => Promise<{ ok: boolean; reasonAr?: string }>
}

const { uploadToCloudinary, deleteFromCloudinary, isCloudinaryEnabled, checkAvatarQuota } =
  cloudinaryLib as unknown as CloudinarySA1

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
}

function checkMagicBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 16))
  for (const [mime, signature] of Object.entries(MAGIC_BYTES)) {
    if (signature.every((byte, i) => bytes[i] === byte)) return mime
  }
  return null
}

interface RouteParams {
  params: Promise<{ username: string }>
}

// POST /api/users/[username]/banner — رفع صورة بانر
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized()
    }

    const { username } = await params
    if (neonUser.username.toLowerCase() !== username.toLowerCase()) {
      return forbidden()
    }

    if (!isCloudinaryEnabled()) {
      return fail('SERVICE_UNAVAILABLE', 'خدمة الصور غير مفعّلة حالياً', 503)
    }

    // Rate limit على رفع الملفات
    const rl = await rateLimit(req, { limit: 5, window: 300, keyPrefix: 'upload:banner' })
    if (!rl.success) {
      return rateLimited()
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return validationFail({ file: 'No file' })
    }

    // حظر SVG
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'svg' || file.type === 'image/svg+xml') {
      return validationFail({ file: 'ملفات SVG غير مسموحة' })
    }

    // فحص الحجم (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return validationFail({ file: 'حجم الصورة كبير جداً — الحد الأقصى 5MB' })
    }

    // قراءة الملف لفحص magic bytes
    const arrayBuffer = await file.arrayBuffer()

    // فحص magic bytes
    const detectedMime = checkMagicBytes(arrayBuffer)
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return validationFail({ file: 'نوع الملف غير مسموح' })
    }

    // حصة صور الحساب (creators: quota engine, others: 50MB lifetime)
    const quota = await checkAvatarQuota(neonUser.id, file.size)
    if (!quota.ok) {
      return validationFail({ file: quota.reasonAr ?? 'تجاوزت حد الرفع المسموح' })
    }

    const buffer = Buffer.from(arrayBuffer)

    // حذف البانر القديم قبل الرفع (best-effort — لا يحجب الرفع عند الفشل)
    try {
      const existing = await db.user.findUnique({
        where: { id: neonUser.id },
        select: { bannerPublicId: true },
      })
      if (existing?.bannerPublicId) {
        await deleteFromCloudinary(existing.bannerPublicId).catch(() => {})
      }
    } catch {
      console.warn('[banner upload] old asset cleanup failed')
    }

    let uploaded: { url: string; publicId: string }
    try {
      uploaded = await uploadToCloudinary(buffer, {
        folder: 'games-arabic/banners',
        transform: 'w_1500,h_500,c_fill,q_auto,f_webp',
      })
    } catch (err) {
      console.error('[banner upload] failed:', err)
      return internalError('Failed')
    }

    await db.user.update({
      where: { id: neonUser.id },
      data: { bannerUrl: uploaded.url, bannerPublicId: uploaded.publicId },
    })

    return ok({ url: uploaded.url, publicId: uploaded.publicId })
  } catch (err) {
    console.error('[banner upload] failed:', err)
    return internalError('Failed')
  }
}

// DELETE /api/users/[username]/banner — حذف صورة البانر
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized()
    }

    const { username } = await params
    if (neonUser.username.toLowerCase() !== username.toLowerCase()) {
      return forbidden()
    }

    try {
      const existing = await db.user.findUnique({
        where: { id: neonUser.id },
        select: { bannerPublicId: true },
      })
      if (existing?.bannerPublicId) {
        await deleteFromCloudinary(existing.bannerPublicId).catch(() => {})
      }
    } catch {
      console.warn('[banner delete] old asset cleanup failed')
    }

    try {
      await db.user.update({
        where: { id: neonUser.id },
        data: { bannerUrl: null, bannerPublicId: null },
      })
    } catch {
      console.warn('[banner delete] db clear failed')
    }

    return ok({ message: 'تم حذف صورة البانر' })
  } catch (err) {
    console.error('[banner delete] failed:', err)
    return ok({ message: 'تم حذف صورة البانر' })
  }
}
