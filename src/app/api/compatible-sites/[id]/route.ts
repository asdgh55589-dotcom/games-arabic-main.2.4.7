import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { brandLogoUrl } from '@/lib/download-trust'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { sanitizeDomains } from '../route'

// تطبيع صف الموقع للاستجابة
function toSite(row: {
  id: string
  name: string
  domains: unknown
  logoUrl: string | null
  notes: string | null
  enabled: boolean
  order: number
}) {
  const domains = Array.isArray(row.domains) ? (row.domains as string[]) : []
  return {
    id: row.id,
    name: row.name,
    domains,
    logoUrl: row.logoUrl,
    notes: row.notes,
    enabled: row.enabled,
    order: row.order,
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/compatible-sites/[id] — تعديل موقع متوافق (إداريون فقط)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json().catch(() => null)

    const existing = await db.compatibleSite.findUnique({ where: { id } })
    if (!existing) return notFound('الموقع غير موجود')

    const data: Record<string, unknown> = {}

    // اسم الموقع حتى 80 حرفاً
    if (body?.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name || name.length > 80) {
        return validationFail('اسم الموقع مطلوب (حتى 80 حرفاً)')
      }
      data.name = name.slice(0, 80)
    }

    // النطاقات: مصفوفة صحيحة حتى 20 (تُقبل مفصولة بفواصل أيضاً)
    let firstDomain: string | null = null
    if (body?.domains !== undefined) {
      const domains = sanitizeDomains(body.domains)
      if (!domains) {
        return validationFail('قائمة النطاقات غير صالحة — نطاق صحيح واحد على الأقل (حتى 20)')
      }
      data.domains = domains
      firstDomain = domains[0]
    }

    // ملاحظات الموقع حتى 2000 حرف
    if (body?.notes !== undefined) {
      const rawNotes = body.notes == null ? null : String(body.notes).trim()
      if (rawNotes != null && rawNotes.length > 2000) {
        return validationFail('الملاحظات يجب ألا تتجاوز 2000 حرف')
      }
      data.notes = rawNotes && rawNotes.length > 0 ? rawNotes.slice(0, 2000) : null
    }

    // اللوجو: رابط صحيح يُقبل، وإلا يُملأ تلقائياً من أول نطاق
    if (body?.logoUrl !== undefined) {
      let logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : ''
      if (!/^https?:\/\/.{4,500}$/.test(logoUrl)) {
        // نستخدم النطاق الجديد أو الحالي للتوليد التلقائي
        const fallbackDomain =
          firstDomain ??
          (Array.isArray(existing.domains) && existing.domains.length > 0
            ? String((existing.domains as string[])[0])
            : null)
        if (body.logoUrl && body.logoUrl.trim() !== '' && !fallbackDomain) {
          return validationFail('رابط اللوجو غير صالح')
        }
        logoUrl = fallbackDomain ? brandLogoUrl(fallbackDomain) : ''
      }
      data.logoUrl = logoUrl ? logoUrl.slice(0, 500) : null
    } else if (firstDomain) {
      // تغيّرت النطاقات دون لوجو صريح — حدّث اللوجو التلقائي إن كان تلقائياً
      const currentLogo = existing.logoUrl ?? ''
      const isAutoLogo =
        !currentLogo ||
        currentLogo.includes('google.com/s2/favicons') ||
        !/^https?:\/\/.{4,500}$/.test(currentLogo)
      if (isAutoLogo) data.logoUrl = brandLogoUrl(firstDomain).slice(0, 500)
    }

    if (body?.enabled !== undefined) data.enabled = Boolean(body.enabled)
    if (body?.order !== undefined) {
      data.order = Number.isFinite(Number(body.order)) ? Math.trunc(Number(body.order)) : 0
    }

    const updated = await db.compatibleSite.update({ where: { id }, data })
    return ok(toSite(updated))
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'PUT /api/compatible-sites/[id]' })
    logger.error({ err: error, route: 'PUT /api/compatible-sites/[id]' }, 'Failed to update compatible site')
    return internalError('فشل تعديل الموقع المتوافق')
  }
}

// DELETE /api/compatible-sites/[id] — حذف موقع متوافق (إداريون فقط)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params
    const existing = await db.compatibleSite.findUnique({ where: { id } })
    if (!existing) return notFound('الموقع غير موجود')
    await db.compatibleSite.delete({ where: { id } })
    return ok({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'DELETE /api/compatible-sites/[id]' })
    logger.error({ err: error, route: 'DELETE /api/compatible-sites/[id]' }, 'Failed to delete compatible site')
    return internalError('فشل حذف الموقع المتوافق')
  }
}
