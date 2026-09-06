import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { buildIaKey, isIaConfigured, sanitizeIaSegment, signIaPut } from '@/lib/ia'
import { checkUploadQuota } from '@/lib/quota'

const ALLOWED_ARCHIVE_MIMES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-xz',
  'application/x-iso9660-image',
  'application/octet-stream',
]
const ALLOWED_EXT = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso']

// POST /api/storage/ia/sign — presigned PUT for DIRECT browser→IA upload.
// Body: { filename, mime, bytes, modSlug?, title? }
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return validationFail('يجب تسجيل الدخول')
    if (!isIaConfigured()) {
      return internalError('خدمة رفع الملفات غير متاحة حالياً — حاول لاحقاً')
    }

    const body = await req.json().catch(() => null)
    const filename = typeof body?.filename === 'string' ? body.filename : ''
    const mime = typeof body?.mime === 'string' ? body.mime : 'application/octet-stream'
    const bytes = Math.floor(Number(body?.bytes))
    const modSlug = typeof body?.modSlug === 'string' ? body.modSlug : 'mod'
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : filename

    const ext = filename.split('.').pop()?.toLowerCase() || ''
    if (!filename || !ALLOWED_EXT.includes(ext)) {
      return validationFail('صيغة الملف غير مدعومة — يُسمح بأرشيفات zip, rar, 7z, tar, gz, bz2, xz, iso فقط')
    }
    if (!ALLOWED_ARCHIVE_MIMES.includes(mime)) {
      return validationFail('نوع الملف غير مدعوم لرفع الأرشيف')
    }
    if (!Number.isInteger(bytes) || bytes <= 0) {
      return validationFail('حجم الملف غير صالح')
    }

    const check = await checkUploadQuota(user.id, user.role, bytes)
    if (!check.allowed) {
      return validationFail(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    const key = buildIaKey(user.id, modSlug, sanitizeIaSegment(filename))
    const signed = await signIaPut({
      key,
      contentType: mime,
      contentLength: bytes,
      title,
      creator: user.username,
    })

    return ok(
      {
        uploadUrl: signed.uploadUrl,
        downloadUrl: signed.downloadUrl,
        key: signed.key,
        identifier: signed.identifier,
        expiresIn: signed.expiresIn,
        headers: { 'Content-Type': mime },
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[ia/sign] failed:', err)
    return internalError('فشل تجهيز الرفع — حاول مرة أخرى')
  }
}
