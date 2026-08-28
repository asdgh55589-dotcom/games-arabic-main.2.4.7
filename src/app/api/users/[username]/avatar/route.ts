import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/server'
import { getOptionalSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { ok, notFound, forbidden, unauthorized, rateLimited, validationFail, internalError } from '@/lib/api-response'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
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

// POST /api/users/[username]/avatar — رفع صورة شخصية
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const startedAt = Date.now()

    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized()
    }

    const { username } = await params
    if (neonUser.username.toLowerCase() !== username.toLowerCase()) {
      return forbidden()
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return internalError('Storage not configured')
    }

    // Rate limit على رفع الملفات
    const rl = await rateLimit(req, { limit: 5, window: 300, keyPrefix: 'upload:avatar' })
    if (!rl.success) {
      return rateLimited()
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return validationFail({ file: 'No file' })
    }

    // حظر SVG (قد يحتوي scripts)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'svg' || file.type === 'image/svg+xml') {
      return validationFail({ file: 'ملفات SVG غير مسموحة' })
    }

    // فحص الحجم (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return validationFail({ file: 'File too large (max 5MB)' })
    }

    // قراءة الملف لفحص magic bytes
    const arrayBufferStartedAt = Date.now()
    const arrayBuffer = await file.arrayBuffer()

    console.log('[avatar upload] arrayBuffer ms:', Date.now() - arrayBufferStartedAt)

    // فحص نوع الملف عبر magic bytes (أكثر موثوقية من file.type)
    const detectedMime = checkMagicBytes(arrayBuffer)
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return validationFail({ file: 'نوع الملف غير مسموح' })
    }

    // رفع إلى Supabase Storage
    const path = `avatars/${neonUser.id}.${ext || 'jpg'}`
    const uploadStartedAt = Date.now()

    const { error: uploadError } = await adminClient.storage
      .from('avatars')
      .upload(path, arrayBuffer, {
        contentType: detectedMime,
        upsert: true,
      })

    console.log('[avatar upload] storage upload ms:', Date.now() - uploadStartedAt)

    if (uploadError) {
      // لو Bucket مش موجود، ننشئه
      await adminClient.storage.createBucket('avatars', { public: true })
      await adminClient.storage.from('avatars').upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })
    }

    const { data: urlData } = adminClient.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = urlData.publicUrl

    const dbStartedAt = Date.now()

    await db.user.update({
      where: { id: neonUser.id },
      data: { avatarUrl },
    })

    console.log('[avatar upload] db update ms:', Date.now() - dbStartedAt)
    console.log('[avatar upload] total ms:', Date.now() - startedAt)

    return ok({ avatarUrl })
  } catch (err) {
    console.error('[avatar POST] failed:', err)
    return internalError('Failed')
  }
}
