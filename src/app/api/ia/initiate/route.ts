import type { NextRequest } from 'next/server'
import { fail, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { IA_COMING_SOON_MESSAGE, buildIaKey, isIaConfigured, isIaEnabled, sanitizeIaSegment } from '@/lib/ia'
import { IA_PART_SIZE } from '@/lib/ia-multipart-client'
import { iaCreateMultipart } from '@/lib/ia-multipart'
import { checkUploadQuota } from '@/lib/quota'

const IA_MAX_PARTS = 1000

// POST /api/ia/initiate — quota gate + IA CreateMultipart + journal row.
// Body: { filename, mime?, bytes, modSlug?, modId?, title? }
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return validationFail('يجب تسجيل الدخول')
    if (!isIaEnabled()) {
      return fail('COMING_SOON', IA_COMING_SOON_MESSAGE, 503)
    }
    if (!isIaConfigured()) {
      return internalError('خدمة رفع الملفات غير متاحة حالياً — حاول لاحقاً')
    }

    const body = await req.json().catch(() => null)
    const filename = sanitizeIaSegment(
      decodeURIComponent(typeof body?.filename === 'string' ? body.filename : ''),
    )
    const mime = typeof body?.mime === 'string' && body.mime ? body.mime.slice(0, 127) : 'application/octet-stream'
    const bytes = Math.floor(Number(body?.bytes))
    const modSlug = sanitizeIaSegment(typeof body?.modSlug === 'string' ? body.modSlug : 'mod')
    const modId = typeof body?.modId === 'string' && body.modId ? body.modId : null
    const title = typeof body?.title === 'string' && body.title ? body.title : filename

    if (!Number.isInteger(bytes) || bytes <= 0) {
      return validationFail('حجم الملف غير صالح')
    }

    // Quota gate on the FULL file (2GB/file, 10/day, 20GB total via engine).
    const check = await checkUploadQuota(user.id, user.role, bytes)
    if (!check.allowed) {
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    const totalParts = Math.max(1, Math.ceil(bytes / IA_PART_SIZE))
    if (totalParts > IA_MAX_PARTS) {
      return validationFail('الملف كبير جداً للرفع المُجزّأ')
    }

    const key = buildIaKey(user.id, modSlug, filename)
    let uploadId: string
    try {
      uploadId = await iaCreateMultipart({ key, contentType: mime, title, creator: user.username })
    } catch (err) {
      console.error('[ia/initiate] IA create failed:', err)
      return internalError('تعذّر بدء الرفع في الأرشيف — حاول مرة أخرى')
    }

    const session = await db.iaMultipartUpload.create({
      data: {
        userId: user.id,
        modId,
        key,
        uploadId,
        totalBytes: BigInt(bytes),
        partSize: IA_PART_SIZE,
        totalParts,
        parts: {},
        status: 'initiated',
      },
    })

    return ok(
      {
        sessionId: session.id,
        uploadId,
        key,
        partSize: IA_PART_SIZE,
        totalParts,
        parts: {},
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[ia/initiate] failed:', err)
    return internalError('فشل بدء الرفع — حاول مرة أخرى')
  }
}
