import type { NextRequest } from 'next/server'
import { fail, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { IA_COMING_SOON_MESSAGE, isIaEnabled } from '@/lib/ia'

// POST /api/storage/upload-file — unified mod-file upload endpoint.
// Phase 2.1: Internet Archive is TEMPORARILY DISABLED (live diagnostics:
// no presigned URLs, no append, no multipart, no tus). The IA adapter code
// (sign/relay/complete) is kept for future use behind IA_ENABLED.
// Future path: stream to R2 buffer → background job → IA, then record
// usage with provider 'ia'. Until then: direct links ONLY (kept forever).
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return validationFail('يجب تسجيل الدخول')

  if (!isIaEnabled()) {
    return fail('COMING_SOON', IA_COMING_SOON_MESSAGE, 503)
  }

  // IA enabled (future): this is where the R2-buffered flow plugs in.
  // Kept unreachable until then — fail closed, never half-upload.
  return fail('COMING_SOON', IA_COMING_SOON_MESSAGE, 503)
}
