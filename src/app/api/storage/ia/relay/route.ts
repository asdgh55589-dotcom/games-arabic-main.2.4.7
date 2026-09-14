import { Readable } from 'node:stream'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { NextRequest } from 'next/server'
import { fail, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getIaClient, getIaConfig, iaDownloadUrl, IA_COMING_SOON_MESSAGE, isIaConfigured, isIaEnabled, sanitizeIaSegment, buildIaKey } from '@/lib/ia'
import { checkUploadQuota } from '@/lib/quota'
import { reportError } from '@/lib/error-reporting'

// POST /api/storage/ia/relay — FALLBACK when browser→IA direct is blocked
// (e.g. IA S3 CORS). Raw octet-stream body + x-ia-* headers; the server
// STREAMS bytes to IA with explicit Content-Length (flat memory) — our bandwidth
// is consumed, so prefer IA_UPLOAD_MODE=direct whenever it works.
//
// DIAGNOSTIC CONSTRAINT (live-tested): IA answers 411 Length Required to
// chunked transfer-encoding — ContentLength is therefore REQUIRED below
// (taken from x-ia-bytes, validated against quota). Never stream without it.
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

    const filename = sanitizeIaSegment(decodeURIComponent(req.headers.get('x-ia-filename') || ''))
    const mime = req.headers.get('x-ia-mime') || 'application/octet-stream'
    const modSlug = req.headers.get('x-ia-modslug') || 'mod'
    const title = req.headers.get('x-ia-title') || filename
    const bytes = Math.floor(Number(req.headers.get('x-ia-bytes')))

    if (!req.body) return validationFail('جسم الطلب فارغ')
    if (!Number.isInteger(bytes) || bytes <= 0) {
      return validationFail('حجم الملف غير صالح')
    }

    const check = await checkUploadQuota(user.id, user.role, bytes)
    if (!check.allowed) {
      // Drain nothing — client already sent bytes; just refuse + Arabic reason.
      try { await req.arrayBuffer() } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort cleanup
      }
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    const c = getIaConfig()
    const key = buildIaKey(user.id, modSlug, filename)
    const s3 = getIaClient()
    await s3.send(
      new PutObjectCommand({
        Bucket: c.identifier,
        Key: key,
        Body: Readable.fromWeb(req.body as never) as never,
        ContentLength: bytes,
        ContentType: mime,
        Metadata: { title: title.slice(0, 200), creator: user.username.slice(0, 100) },
      }),
    )

    return ok(
      { downloadUrl: iaDownloadUrl(c.identifier, key), key, identifier: c.identifier, bytes },
      { status: 201 },
    )
  } catch (err) {
    console.error('[ia/relay] failed:', err)
    reportError(err, { route: 'POST /api/storage/ia/relay' })
    return internalError('فشل رفع الملف — حاول مرة أخرى')
  }
}
