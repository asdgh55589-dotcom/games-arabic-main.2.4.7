import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractHostname } from '@/lib/download-trust'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/admin/mod-site-links/[id] — تعديل رابط موقع متوافق (إداريون فقط)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json().catch(() => null)

    const existing = await db.modSiteLink.findUnique({ where: { id } })
    if (!existing) return notFound('الرابط غير موجود')

    const data: Record<string, unknown> = {}

    // تغيير المود (نادر — مع فحص الوجود)
    let modId = existing.modId
    if (body?.modId !== undefined) {
      const nextModId = typeof body.modId === 'string' ? body.modId.trim() : ''
      if (!nextModId) return validationFail('modId مطلوب')
      const mod = await db.mod.findUnique({ where: { id: nextModId }, select: { id: true } })
      if (!mod) return validationFail('المود غير موجود')
      modId = nextModId
      data.modId = nextModId
    }

    // تغيير الملف (null = قسم خارجي)
    if (body?.fileId !== undefined) {
      if (body.fileId === null || String(body.fileId).trim() === '') {
        data.fileId = null
      } else {
        const fileId = String(body.fileId).trim()
        const file = await db.modFile.findUnique({ where: { id: fileId }, select: { id: true, modId: true } })
        if (!file) return validationFail('الملف غير موجود')
        if (file.modId !== modId) return validationFail('الملف لا ينتمي لنفس المود')
        data.fileId = fileId
      }
    }

    // الرابط يجب أن يكون http/https
    if (body?.url !== undefined) {
      const url = typeof body.url === 'string' ? body.url.trim() : ''
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
      data.url = url
      // حدّث النطاق تلقائياً عند تغيير الرابط دون نطاق صريح
      if (body?.domain === undefined) {
        data.domain = extractHostname(url)
      }
    }

    if (body?.siteName !== undefined) {
      data.siteName =
        body.siteName == null || String(body.siteName).trim() === ''
          ? null
          : String(body.siteName).trim().slice(0, 200)
    }

    if (body?.pageTitle !== undefined) {
      data.pageTitle =
        body.pageTitle == null || String(body.pageTitle).trim() === ''
          ? null
          : String(body.pageTitle).trim().slice(0, 500)
    }

    if (body?.domain !== undefined) {
      data.domain =
        body.domain == null || String(body.domain).trim() === ''
          ? extractHostname(String((data.url as string) ?? existing.url)) ?? null
          : String(body.domain).trim().toLowerCase().slice(0, 253)
    }

    if (body?.order !== undefined) {
      data.order = Number.isFinite(Number(body.order)) ? Math.trunc(Number(body.order)) : 0
    }

    const updated = await db.modSiteLink.update({ where: { id }, data })
    return ok(updated)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'PUT /api/admin/mod-site-links/[id]' })
    logger.error({ err: error, route: 'PUT /api/admin/mod-site-links/[id]' }, 'Failed to update mod site link')
    return internalError('فشل تعديل رابط الموقع')
  }
}

// DELETE /api/admin/mod-site-links/[id] — حذف رابط موقع متوافق (إداريون فقط)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params
    const existing = await db.modSiteLink.findUnique({ where: { id } })
    if (!existing) return notFound('الرابط غير موجود')
    await db.modSiteLink.delete({ where: { id } })
    return ok({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'DELETE /api/admin/mod-site-links/[id]' })
    logger.error({ err: error, route: 'DELETE /api/admin/mod-site-links/[id]' }, 'Failed to delete mod site link')
    return internalError('فشل حذف رابط الموقع')
  }
}
