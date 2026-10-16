import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractHostname } from '@/lib/download-trust'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

// استخراج النطاق من الرابط (denormalized للفلترة)
function domainFromUrl(url: string): string | null {
  return extractHostname(url)
}

// POST /api/admin/mod-site-links — إنشاء رابط موقع متوافق كإضافة (إداريون فقط)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)

    // معرف المود مطلوب ويجب أن يكون موجوداً
    const modId = typeof body?.modId === 'string' ? body.modId.trim() : ''
    if (!modId) return validationFail('modId مطلوب')
    const mod = await db.mod.findUnique({ where: { id: modId }, select: { id: true } })
    if (!mod) return validationFail('المود غير موجود')

    // معرف الملف اختياري (null = قسم خارجي، قيمة = متداخل داخل الملف)
    let fileId: string | null = null
    if (body?.fileId !== undefined && body?.fileId !== null && String(body.fileId).trim() !== '') {
      fileId = String(body.fileId).trim()
      const file = await db.modFile.findUnique({ where: { id: fileId }, select: { id: true, modId: true } })
      if (!file) return validationFail('الملف غير موجود')
      if (file.modId !== modId) return validationFail('الملف لا ينتمي لنفس المود')
    }

    // الرابط يجب أن يكون http/https
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!url) return validationFail('url مطلوب')
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return validationFail('الرابط غير صالح — يجب أن يبدأ بـ http/https')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return validationFail('الرابط غير صالح — يجب أن يبدأ بـ http/https')
    }

    // اسم الموقع وعنوان الصفحة (اختياريان)
    const siteName =
      body?.siteName == null || String(body.siteName).trim() === ''
        ? null
        : String(body.siteName).trim().slice(0, 200)
    const pageTitle =
      body?.pageTitle == null || String(body.pageTitle).trim() === ''
        ? null
        : String(body.pageTitle).trim().slice(0, 500)

    // النطاق يُستخرج تلقائياً من الرابط لو غائب
    let domain =
      body?.domain == null || String(body.domain).trim() === ''
        ? null
        : String(body.domain).trim().toLowerCase().slice(0, 253)
    if (!domain) domain = domainFromUrl(url)

    const order = Number.isFinite(Number(body?.order)) ? Math.trunc(Number(body.order)) : 0

    const created = await db.modSiteLink.create({
      data: { modId, fileId, url, siteName, pageTitle, domain, order },
    })
    return ok(created)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'POST /api/admin/mod-site-links' })
    logger.error({ err: error, route: 'POST /api/admin/mod-site-links' }, 'Failed to create mod site link')
    return internalError('فشل إنشاء رابط الموقع')
  }
}
