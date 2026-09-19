import type { NextRequest } from 'next/server'
import { fail, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { IA_COMING_SOON_MESSAGE, isIaEnabled } from '@/lib/ia'

// POST /api/storage/ia/sign — DEPRECATED (501).
//
// Query-presigned SigV4 URLs are PROVEN DEAD against live IA
// (403 InvalidAccessKeyId — see ../README.md). Kept as a route so clients
// get an explicit "use relay" signal instead of a timeout. Use
// POST /api/storage/ia/relay (server-streamed SigV4 PUT) instead.
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) {
    return validationFail('يجب تسجيل الدخول')
  }
  if (!isIaEnabled()) {
    return fail('COMING_SOON', IA_COMING_SOON_MESSAGE, 503)
  }
  return fail(
    'DEPRECATED',
    'وضع الرفع المباشر الموقّع متوقف — يُرجى استخدام وضع relay (الخادم الوسيط)',
    501,
  )
}
