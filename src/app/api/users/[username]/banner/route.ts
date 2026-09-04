import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/server'
import { getOptionalSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import {
  ok,
  notFound,
  forbidden,
  unauthorized,
  rateLimited,
  validationFail,
  internalError,
} from '@/lib/api-response'

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

    if (file.size > 10 * 1024 * 1024) {
      return validationFail({ file: 'File too large (max 10MB)' })
    }

    const arrayBufferStartedAt = Date.now()
    const arrayBuffer = await file.arrayBuffer()

    console.log('[banner upload] arrayBuffer ms:', Date.now() - arrayBufferStartedAt)

    // فحص magic bytes
    const detectedMime = checkMagicBytes(arrayBuffer)
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return validationFail({ file: 'نوع الملف غير مسموح' })
    }

    const path = `banners/${neonUser.id}.${ext || 'jpg'}`

    const uploadStartedAt = Date.now()

    const { error: uploadError } = await adminClient.storage
      .from('banners')
      .upload(path, arrayBuffer, {
        contentType: detectedMime,
        upsert: true,
      })

    console.log('[banner upload] storage upload ms:', Date.now() - uploadStartedAt)

    if (uploadError) {
      const shouldCreateBucket =
        uploadError.message?.includes('Bucket not found') || uploadError.name === 'StorageApiError'

      if (!shouldCreateBucket) {
        console.error('[banner upload] failed:', uploadError)
        return internalError('Upload failed')
      }

      if (!adminClient) {
        console.error('[banner upload] missing SUPABASE_SERVICE_ROLE_KEY')
        return internalError('Storage is not configured correctly')
      }

      const { error: createBucketError } = await adminClient.storage.createBucket('banners', {
        public: true,
      })

      if (createBucketError && !createBucketError.message?.includes('already exists')) {
        console.error('[banner bucket create] failed:', createBucketError)
        return internalError('Failed to create storage bucket')
      }

      const { error: retryUploadError } = await adminClient.storage
        .from('banners')
        .upload(path, arrayBuffer, {
          contentType: detectedMime,
          upsert: true,
        })

      if (retryUploadError) {
        console.error('[banner retry upload] failed:', retryUploadError)
        return internalError('Upload failed')
      }
    }

    const { data: urlData } = adminClient.storage.from('banners').getPublicUrl(path)

    const dbStartedAt = Date.now()

    const updatedUser = await db.user.update({
      where: { id: neonUser.id },
      data: { bannerUrl: urlData.publicUrl },
      select: { bannerUrl: true },
    })

    console.log('[banner upload] db update ms:', Date.now() - dbStartedAt)
    console.log('[banner upload] total ms:', Date.now() - startedAt)

    return ok({ bannerUrl: updatedUser.bannerUrl })
  } catch (err) {
    console.error('[banner upload] failed:', err)
    return internalError('Failed')
  }
}
