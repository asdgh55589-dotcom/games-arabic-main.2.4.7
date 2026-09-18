import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { fileCategory } from '@/lib/file-types'

const FORMATS = ['html', 'markdown', 'bbcode'] as const
type EmbedFormat = (typeof FORMATS)[number]

function fileNameOf(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts[parts.length - 1] || 'ملف')
  } catch {
    return 'ملف'
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build a copy-paste snippet for a file the caller owns. Exported for tests. */
export function buildEmbedCode(
  url: string,
  mime: string | null,
  format: EmbedFormat,
): string {
  const name = fileNameOf(url)
  const safeUrl = encodeURI(url).replace(/"/g, '%22')
  const safeName = escapeAttr(name)
  const category = fileCategory(mime, url)
  const isImage = category === 'image'
  const isVideo = category === 'video'

  switch (format) {
    case 'html':
      if (isImage) return `<img src="${safeUrl}" alt="${safeName}" loading="lazy">`
      if (isVideo) return `<video src="${safeUrl}" controls preload="metadata"></video>`
      return `<a href="${safeUrl}" download>${safeName}</a>`
    case 'markdown':
      if (isImage) return `![${name}](${url})`
      return `[${name}](${url})`
    case 'bbcode':
      if (isImage) return `[img]${url}[/img]`
      return `[url=${url}]${name}[/url]`
  }
}

// POST /api/creator/files/embed-code — كود تضمين لملف من ملفاتي
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return internalError('يجب تسجيل الدخول')

    const body = await req.json().catch(() => null)
    const fileId = typeof body?.fileId === 'string' ? body.fileId : ''
    const format = body?.format as EmbedFormat
    if (!fileId) return validationFail('fileId مطلوب')
    if (!FORMATS.includes(format)) return validationFail('الصيغة يجب أن تكون html أو markdown أو bbcode')

    const asset = await db.uploadAsset.findUnique({ where: { id: fileId } })
    if (!asset || asset.userId !== user.id) {
      return notFound('الملف غير موجود — قد تم حذفه مسبقاً')
    }

    return ok({ ok: true, format, code: buildEmbedCode(asset.originalUrl, asset.mime, format) })
  } catch (err) {
    console.error('[creator/files/embed-code] failed:', err)
    reportError(err, { route: 'POST /api/creator/files/embed-code' })
    return internalError('فشل إنشاء كود التضمين')
  }
}
