import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { IA_COMING_SOON_MESSAGE, isIaConfigured, isIaEnabled } from '@/lib/ia'
import { iaUploadPart } from '@/lib/ia-multipart'

// POST /api/ia/part — stream ONE ≤5MB chunk to IA (LOW auth, never disk).
// Headers: x-ia-session, x-ia-part (1-based), x-ia-md5 (hex of raw bytes).
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

    const sessionId = req.headers.get('x-ia-session') || ''
    const partNumber = Math.floor(Number(req.headers.get('x-ia-part')))
    const clientMd5 = (req.headers.get('x-ia-md5') || '').toLowerCase()
    if (!sessionId || !Number.isInteger(partNumber) || partNumber <= 0) {
      return validationFail('بيانات الجزء غير صالحة')
    }
    if (!/^[0-9a-f]{32}$/.test(clientMd5)) {
      return validationFail('بصمة الجزء غير صالحة')
    }

    const session = await db.iaMultipartUpload.findUnique({ where: { id: sessionId } })
    if (!session) return notFound('جلسة الرفع غير موجودة')
    if (session.userId !== user.id) return forbidden('جلسة رفع لا تخصك')
    if (session.status !== 'initiated' && session.status !== 'parts') {
      return validationFail('الجلسة مغلقة — ابدأ رفعاً جديداً')
    }
    if (partNumber > session.totalParts) {
      return validationFail('رقم الجزء خارج النطاق')
    }

    if (!req.body) return validationFail('جسم الطلب فارغ')
    const buf = Buffer.from(await req.arrayBuffer())
    if (buf.length === 0 || buf.length > session.partSize) {
      return validationFail('حجم الجزء غير صالح')
    }

    // Authoritative md5 (server) must match the client claim — IA returns
    // no ETag, so a mismatch here is the ONLY corruption signal. Reject.
    const serverMd5 = createHash('md5').update(buf).digest('hex')
    if (serverMd5 !== clientMd5) {
      return validationFail('البصمة غير متطابقة — أعد إرسال الجزء')
    }

    try {
      await iaUploadPart({
        key: session.key,
        uploadId: session.uploadId,
        partNumber,
        body: new Uint8Array(buf),
      })
    } catch (err) {
      console.error('[ia/part] IA upload failed:', err)
      return internalError('فشل إرسال الجزء إلى الأرشيف — أعد المحاولة')
    }

    const parts = { ...((session.parts as Record<string, string>) || {}) }
    parts[partNumber] = serverMd5
    await db.iaMultipartUpload.update({
      where: { id: session.id },
      data: { parts, status: 'parts' },
    })

    return ok({ partNumber, md5: serverMd5, partsDone: Object.keys(parts).length })
  } catch (err) {
    console.error('[ia/part] failed:', err)
    return internalError('فشل إرسال الجزء — حاول مرة أخرى')
  }
}
