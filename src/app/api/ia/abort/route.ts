import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { IA_COMING_SOON_MESSAGE, isIaConfigured, isIaEnabled } from '@/lib/ia'
import { iaAbortMultipart } from '@/lib/ia-multipart'

// POST /api/ia/abort — best-effort IA multipart cleanup + journal abort.
// Body: { sessionId }
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

    // Best-effort: the journal row is the source of truth even if IA
    // already dropped the upload (expiry) or the abort call fails.
    try {
      if (session.status === 'initiated' || session.status === 'parts') {
        await iaAbortMultipart({ key: session.key, uploadId: session.uploadId })
      }
    } catch (err) {
      console.error('[ia/abort] IA abort failed (journal still marked):', err)
    }

    await db.iaMultipartUpload.update({
      where: { id: session.id },
      data: { status: 'aborted' },
    })

    return ok({ sessionId: session.id, status: 'aborted' })
  } catch (err) {
    console.error('[ia/abort] failed:', err)
    return internalError('فشل إلغاء الرفع — حاول مرة أخرى')
  }
}
