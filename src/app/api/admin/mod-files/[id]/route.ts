import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/admin/mod-files/[id] — تعديل ملف تحميل (إداريون فقط)
// يقبل parentId (ملفات إضافية متداخلة) و extrasLabel (عنوان القسم)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json().catch(() => null)

    const existing = await db.modFile.findUnique({ where: { id } })
    if (!existing) return notFound('الملف غير موجود')

    const data: Record<string, unknown> = {}

    // حقول نصية اختيارية
    if (body?.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) return validationFail('عنوان الملف مطلوب')
      data.title = title.slice(0, 200)
    }
    if (body?.description !== undefined) {
      data.description =
        body.description == null || String(body.description).trim() === ''
          ? null
          : String(body.description).trim()
    }
    if (body?.alert !== undefined) {
      data.alert =
        body.alert == null || String(body.alert).trim() === '' ? null : String(body.alert).trim()
    }
    if (body?.version !== undefined) {
      const version = typeof body.version === 'string' ? body.version.trim() : ''
      if (!version) return validationFail('رقم النسخة مطلوب')
      data.version = version.slice(0, 50)
    }
    if (body?.fileSize !== undefined) {
      data.fileSize = String(body.fileSize ?? '').trim().slice(0, 50) || existing.fileSize
    }
    if (body?.fileFormat !== undefined) {
      data.fileFormat = String(body.fileFormat ?? '').trim().slice(0, 20) || existing.fileFormat
    }
    if (body?.order !== undefined) {
      data.order = Number.isFinite(Number(body.order)) ? Math.trunc(Number(body.order)) : 0
    }

    // الأب للملفات الإضافية: يجب أن ينتمي لنفس المود ولا يساوي نفسه
    if (body?.parentId !== undefined) {
      if (body.parentId === null || String(body.parentId).trim() === '') {
        data.parentId = null
      } else {
        const parentId = String(body.parentId).trim()
        if (parentId === id) return validationFail('الملف لا يمكن أن يكون أباً لنفسه')
        const parent = await db.modFile.findUnique({
          where: { id: parentId },
          select: { id: true, modId: true },
        })
        if (!parent) return validationFail('الملف الأب غير موجود')
        if (parent.modId !== existing.modId) return validationFail('الملف الأب لا ينتمي لنفس المود')
        data.parentId = parentId
      }
    }

    // عنوان قسم الملفات الإضافية داخل هذا الملف
    if (body?.extrasLabel !== undefined) {
      if (body.extrasLabel === null || String(body.extrasLabel).trim() === '') {
        data.extrasLabel = null
      } else {
        const label = String(body.extrasLabel).trim()
        if (label.length > 200) return validationFail('عنوان القسم يجب ألا يتجاوز 200 حرف')
        data.extrasLabel = label.slice(0, 200)
      }
    }

    const updated = await db.modFile.update({ where: { id }, data })
    return ok(updated)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'PUT /api/admin/mod-files/[id]' })
    logger.error({ err: error, route: 'PUT /api/admin/mod-files/[id]' }, 'Failed to update mod file')
    return internalError('فشل تعديل الملف')
  }
}
