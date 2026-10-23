import type { NextRequest } from 'next/server'
import { fail, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import {
  IA_COMING_SOON_MESSAGE,
  getIaConfig,
  iaDownloadUrl,
  iaStorageKey,
  isIaConfigured,
  isIaEnabled,
  sanitizeIaSegment,
  verifyIaObject,
} from '@/lib/ia'
import { logger } from '@/lib/logger'
import { checkUploadQuota, recordUploadUsage } from '@/lib/quota'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function validKeyForUser(key: string, userId: string): boolean {
  if (!key.startsWith(`${sanitizeIaSegment(userId)}/`)) return false
  return key.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

// POST /api/storage/ia/complete — verify + record a finished IA upload.
// Body: { key, downloadUrl, bytes, mime?, modId?, mode: 'direct' | 'relay' }
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
    const key = typeof body?.key === 'string' ? body.key.trim() : ''
    const clientDownloadUrl = typeof body?.downloadUrl === 'string' ? body.downloadUrl : ''
    const bytes = Math.floor(Number(body?.bytes))
    const mime = typeof body?.mime === 'string' ? body.mime : 'application/octet-stream'
    const modId = typeof body?.modId === 'string' && body.modId ? body.modId : undefined

    if (!key || !validKeyForUser(key, user.id)) {
      return validationFail('مفتاح الملف غير صالح')
    }
    if (!Number.isInteger(bytes) || bytes <= 0) {
      return validationFail('حجم الملف غير صالح')
    }

    const identifier = getIaConfig().identifier
    const storageKey = iaStorageKey(identifier, key)
    const downloadUrl = iaDownloadUrl(identifier, key)

    // The client may echo the URL, but it must match the server-derived one —
    // never persist an arbitrary URL for an IA object.
    if (clientDownloadUrl && clientDownloadUrl !== downloadUrl) {
      return validationFail('بيانات الإكمال غير صالحة')
    }

    // Idempotency: relay already records usage; a repeated /complete (retry,
    // double submit) must not double-count or create a second asset.
    const existing = await db.uploadAsset.findFirst({
      where: { userId: user.id, storageKey },
      select: { id: true, originalUrl: true, bytes: true },
    })
    if (existing) {
      return ok(
        {
          downloadUrl: existing.originalUrl || downloadUrl,
          key,
          identifier,
          storageKey,
          bytes: Number(existing.bytes),
          assetId: existing.id,
          usageRecorded: false,
          alreadyRecorded: true,
        },
        { status: 201 },
      )
    }

    // Never trust a client-claimed object: HEAD it in both modes. Relay
    // normally hits the idempotent branch above; direct always lands here.
    let verified = false
    let verifiedBytes: number | undefined
    for (let attempt = 0; attempt < 3 && !verified; attempt++) {
      if (attempt > 0) await sleep(2000)
      const head = await verifyIaObject(key)
      verified = head.ok
      if (head.ok) verifiedBytes = head.bytes
    }
    if (!verified) {
      return validationFail('تعذّر التحقق من وصول الملف إلى الأرشيف — أعد الرفع أو جرّب الرابط المباشر')
    }
    if (verifiedBytes !== undefined && verifiedBytes !== bytes) {
      return validationFail('حجم الملف لا يطابق الحجم المرفوع')
    }

    if (modId) {
      const mod = await db.mod.findFirst({
        where: { id: modId, authorId: user.id },
        select: { id: true },
      })
      if (!mod) return validationFail('التعريب غير موجود أو ليس لك')
    }

    // Entry gate (usage is recorded below regardless — usage = reality).
    const check = await checkUploadQuota(user.id, user.role, bytes)
    if (!check.allowed) {
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحد المسموح')
    }

    try {
      await recordUploadUsage({
        userId: user.id,
        modId,
        kind: 'file',
        provider: 'ia',
        originalUrl: downloadUrl,
        storageKey,
        bytes,
        mime,
      })
    } catch (usageError) {
      logger.error('[ia/complete] usage record failed:', usageError)
    }

    return ok({ downloadUrl, key, identifier, storageKey, bytes }, { status: 201 })
  } catch (err) {
    logger.error('[ia/complete] failed:', err)
    reportError(err, { route: 'POST /api/storage/ia/complete' })
    return internalError('فشل تأكيد الرفع — حاول مرة أخرى')
  }
}
