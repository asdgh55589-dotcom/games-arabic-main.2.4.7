import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/ia/status?session= — journal read for resume (missing parts only).
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return validationFail('يجب تسجيل الدخول')

  const sessionId = req.nextUrl.searchParams.get('session') || ''
  if (!sessionId) return validationFail('معرّف الجلسة مطلوب')

  const session = await db.iaMultipartUpload.findUnique({ where: { id: sessionId } })
  if (!session) return notFound('جلسة الرفع غير موجودة')
  if (session.userId !== user.id) return forbidden('جلسة رفع لا تخصك')

  return ok({
    sessionId: session.id,
    key: session.key,
    totalBytes: Number(session.totalBytes),
    partSize: session.partSize,
    totalParts: session.totalParts,
    parts: (session.parts as Record<string, string>) || {},
    status: session.status,
    downloadUrl: session.downloadUrl,
  })
}
