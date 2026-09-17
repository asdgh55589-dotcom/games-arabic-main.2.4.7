import type { NextRequest } from 'next/server'
import { fail, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import {
  IA_COMING_SOON_MESSAGE,
  getIaConfig,
  iaStorageKey,
  isIaEnabled,
  verifyIaObject,
} from '@/lib/ia'
import { checkUploadQuota, recordUploadUsage } from '@/lib/quota'
import { reportError } from '@/lib/error-reporting'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

    const body = await req.json().catch(() => null)
    const key = typeof body?.key === 'string' ? body.key : ''
    const downloadUrl = typeof body?.downloadUrl === 'string' ? body.downloadUrl : ''
    const bytes = Math.floor(Number(body?.bytes))
    const mime = typeof body?.mime === 'string' ? body.mime : 'application/octet-stream'
    const modId = typeof body?.modId === 'string' && body.modId ? body.modId : undefined
    const mode = body?.mode === 'relay' ? 'relay' : 'direct'

    if (!key || !downloadUrl.startsWith('https://')) {
      return validationFail('بيانات الإكمال غير صالحة')
    }
    if (!Number.isInteger(bytes) || bytes <= 0) {
      return validationFail('حجم الملف غير صالح')
    }

    // Entry gate (usage is recorded below regardless — usage = reality).
    const check = await checkUploadQuota(user.id, user.role, bytes)
    if (!check.allowed) {
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    // Direct mode: best-effort HEAD verification (relay already proved it).
    if (mode === 'direct') {
      let verified = false
      for (let attempt = 0; attempt < 3 && !verified; attempt++) {
        if (attempt > 0) await sleep(2000)
        verified = (await verifyIaObject(key)).ok
      }
      if (!verified) {
        return validationFail('تعذّر التحقق من وصول الملف إلى الأرشيف — أعد الرفع أو جرّب الرابط المباشر')
      }
    }

    // Provenance: persist identifier + key separately so file management
    // can list, verify and delete IA objects later.
    const identifier = getIaConfig().identifier
    const storageKey = iaStorageKey(identifier, key)

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
      console.error('[ia/complete] usage record failed:', usageError)
    }

    return ok({ downloadUrl, key, identifier, storageKey, bytes }, { status: 201 })
  } catch (err) {
    console.error('[ia/complete] failed:', err)
    reportError(err, { route: 'POST /api/storage/ia/complete' })
    return internalError('فشل تأكيد الرفع — حاول مرة أخرى')
  }
}
