import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { getIpBanCache } from '@/lib/ip-ban-cache'
import { IA_COMING_SOON_MESSAGE, isIaConfigured, isIaEnabled, iaStorageKey, sanitizeIaSegment } from '@/lib/ia'
import { readUploadHead, streamIaObject } from '@/lib/ia-stream'
import { logger } from '@/lib/logger'
import { checkUploadQuota, recordUploadUsage } from '@/lib/quota'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import {
  INVALID_UPLOAD_CONTENT_MESSAGE,
  UPLOAD_HEAD_BYTES,
  validateUploadContent,
  validateUploadMeta,
} from '@/lib/upload-validation'

function readHeader(req: NextRequest, name: string): string {
  return req.headers.get(name)?.trim() || ''
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

// POST /api/storage/ia/relay — server-streamed upload to Internet Archive.
// Raw octet-stream body + x-ia-* headers. Bytes are streamed with an explicit
// Content-Length (IA returns 411 for chunked bodies), validated with the same
// MIME + magic-byte gates as the multipart route, and recorded against quota
// server-side (a client cannot skip /complete to avoid accounting).
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return validationFail('يجب تسجيل الدخول')

    // This route is excluded from the proxy matcher (body cloning would
    // truncate the stream), so re-apply the proxy's IP-ban gate here.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      ''
    if (ip) {
      const ban = await getIpBanCache(ip).catch(() => null)
      if (ban?.banned) return forbidden('تم حظر عنوان IP الخاص بك')
    }

    if (!isIaEnabled()) {
      return fail('COMING_SOON', IA_COMING_SOON_MESSAGE, 503)
    }
    if (!isIaConfigured()) {
      return internalError('خدمة رفع الملفات غير متاحة حالياً — حاول لاحقاً')
    }

    const limited = await rateLimitMiddleware(req, {
      limit: 20,
      window: 60,
      keyPrefix: `creator:ia:relay:${user.id}`,
    })
    if (limited) return limited

    const decodedFilename = safeDecode(readHeader(req, 'x-ia-filename'))
    if (decodedFilename === null) {
      return validationFail('اسم الملف غير صالح')
    }
    const declaredMime = readHeader(req, 'x-ia-mime') || 'application/octet-stream'
    const meta = validateUploadMeta(declaredMime, decodedFilename)
    if (!meta.ok) return validationFail(meta.message)

    if (!req.body) return validationFail('جسم الطلب فارغ')

    // Content-Length is the transport truth; x-ia-bytes is only a fallback for
    // chunked requests. If both are present they must agree.
    const contentLength = Number(readHeader(req, 'content-length'))
    const headerBytes = Number(readHeader(req, 'x-ia-bytes'))
    const bytes = Number.isInteger(contentLength) && contentLength > 0 ? contentLength : Math.floor(headerBytes)
    if (Number.isInteger(contentLength) && contentLength > 0 && headerBytes > 0 && contentLength !== headerBytes) {
      return validationFail('حجم الملف لا يطابق البيانات المرسلة')
    }
    if (!Number.isInteger(bytes) || bytes <= 0) {
      return validationFail('حجم الملف غير صالح')
    }

    const check = await checkUploadQuota(user.id, user.role, bytes)
    if (!check.allowed) {
      // Do not buffer a rejected 2GB body — close it and return immediately.
      req.body.cancel().catch(() => undefined)
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    const { head, body } = await readUploadHead(req.body, UPLOAD_HEAD_BYTES)
    if (head.length === 0) return validationFail('جسم الطلب فارغ')
    if (!validateUploadContent(head, meta.rule)) {
      return validationFail(INVALID_UPLOAD_CONTENT_MESSAGE)
    }

    const modIdHeader = readHeader(req, 'x-ia-modid')
    let modId: string | undefined
    let modSlug = sanitizeIaSegment(readHeader(req, 'x-ia-modslug') || 'mod')
    if (modIdHeader) {
      const mod = await db.mod.findFirst({
        where: { id: modIdHeader, authorId: user.id },
        select: { id: true, slug: true },
      })
      if (!mod) return validationFail('التعريب غير موجود أو ليس لك')
      modId = mod.id
      modSlug = sanitizeIaSegment(mod.slug || modSlug)
    }

    const filename = sanitizeIaSegment(decodedFilename)
    const title = readHeader(req, 'x-ia-title').slice(0, 200) || filename
    const idempotencyKey = readHeader(req, 'x-ia-key').slice(0, 100) || undefined

    const result = await streamIaObject({
      userId: user.id,
      username: user.username,
      modSlug,
      filename,
      mime: meta.mime,
      title,
      bytes,
      body,
      idempotencyKey,
    })

    const storageKey = iaStorageKey(result.identifier, result.key)
    let assetId: string | null = null
    let usageRecorded = false
    try {
      const existing = await db.uploadAsset.findFirst({
        where: { userId: user.id, storageKey },
        select: { id: true },
      })
      if (existing) {
        assetId = existing.id
      } else {
        const [, , created] = await recordUploadUsage({
          userId: user.id,
          modId,
          kind: meta.rule.kind,
          provider: 'ia',
          originalUrl: result.downloadUrl,
          storageKey,
          bytes: result.bytes,
          mime: meta.mime,
        })
        assetId = created.id
        usageRecorded = true
      }
    } catch (usageError) {
      // Bytes already landed: never fail the upload (a retry would duplicate
      // the object). /complete retries accounting idempotently.
      logger.error('[ia/relay] usage record failed:', usageError)
    }

    return ok({ ...result, storageKey, assetId, usageRecorded }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('UPLOAD_')) {
      return validationFail('بيانات الملف غير صالحة')
    }
    logger.error('[ia/relay] failed:', err)
    reportError(err, { route: 'POST /api/storage/ia/relay' })
    return internalError('فشل رفع الملف — حاول مرة أخرى')
  }
}
