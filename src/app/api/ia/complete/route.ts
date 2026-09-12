import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { IA_COMING_SOON_MESSAGE, iaDownloadUrl, getIaConfig, isIaConfigured, isIaEnabled } from '@/lib/ia'
import { iaCompleteMultipart, iaWaitAssembled } from '@/lib/ia-multipart'
import { checkUploadQuota, recordUploadUsage } from '@/lib/quota'

export const maxDuration = 150

// POST /api/ia/complete — assemble parts, poll metadata (max 120s),
// record quota + archive.org URL. Body: { sessionId }
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return validationFail('يجب تسجيل الدخول')
    if (!isIaEnabled()) {
      return forbidden(IA_COMING_SOON_MESSAGE)
    }
    if (!isIaConfigured()) {
      return internalError('خدمة رفع الملفات غير متاحة حالياً — حاول لاحقاً')
    }

    const body = await req.json().catch(() => null)
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
    if (!sessionId) return validationFail('معرّف الجلسة مطلوب')

    const session = await db.iaMultipartUpload.findUnique({ where: { id: sessionId } })
    if (!session) return notFound('جلسة الرفع غير موجودة')
    if (session.userId !== user.id) return forbidden('جلسة رفع لا تخصك')
    if (session.status === 'complete') {
      return ok({ downloadUrl: session.downloadUrl, key: session.key, bytes: Number(session.totalBytes) })
    }
    if (session.status !== 'initiated' && session.status !== 'parts') {
      return validationFail('الجلسة مغلقة — ابدأ رفعاً جديداً')
    }

    const parts = (session.parts as Record<string, string>) || {}
    const missing: number[] = []
    for (let n = 1; n <= session.totalParts; n++) {
      if (!parts[n]) missing.push(n)
    }
    if (missing.length > 0) {
      return validationFail(`أجزاء ناقصة: ${missing.slice(0, 10).join('، ')}${missing.length > 10 ? '…' : ''}`)
    }

    try {
      await iaCompleteMultipart({
        key: session.key,
        uploadId: session.uploadId,
        parts: Object.entries(parts).map(([partNumber, md5]) => ({
          partNumber: Number(partNumber),
          md5: String(md5),
        })),
      })
    } catch (err) {
      console.error('[ia/complete] IA assemble failed:', err)
      return internalError('تعذّر تجميع الأجزاء في الأرشيف — حاول مرة أخرى')
    }

    const c = getIaConfig()
    const assembled = await iaWaitAssembled({ identifier: c.identifier, key: session.key })
    if (!assembled) {
      return validationFail('الأرشيف لم يُكمل التجميع بعد — حاول التأكيد بعد قليل')
    }

    const bytes = Number(session.totalBytes)
    const check = await checkUploadQuota(user.id, user.role, bytes)
    if (!check.allowed) {
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    const downloadUrl = iaDownloadUrl(c.identifier, session.key)
    try {
      await recordUploadUsage({
        userId: user.id,
        modId: session.modId,
        kind: 'file',
        provider: 'ia',
        originalUrl: downloadUrl,
        bytes,
        mime: 'application/octet-stream',
      })
    } catch (usageError) {
      console.error('[ia/complete] usage record failed:', usageError)
    }

    await db.iaMultipartUpload.update({
      where: { id: session.id },
      data: { status: 'complete', downloadUrl },
    })

    return ok({ downloadUrl, key: session.key, bytes }, { status: 201 })
  } catch (err) {
    console.error('[ia/complete] failed:', err)
    return internalError('فشل تأكيد الرفع — حاول مرة أخرى')
  }
}
