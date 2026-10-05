import Handlebars from 'handlebars'
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { UpdateTemplateSchema } from '@/lib/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** تسميات عربية لحقول القالب — تُستخدم حين لا تحمل رسالة zod نصاً عربياً. */
const FIELD_AR: Record<string, string> = {
  type: 'نوع الإشعار غير صالح',
  channel: 'قناة الإشعار غير صالحة',
  titleTemplate: 'عنوان القالب مطلوب',
  bodyTemplate: 'محتوى القالب مطلوب',
  variables: 'قائمة المتغيرات غير صالحة',
  isActive: 'قيمة التفعيل غير صالحة',
}

/**
 * رسالة عربية في السطر الرئيسي (error.message) لخطأ تحقق — تفاصيل الحقول تبقى
 * في details التزاماً بعقد api-response لبقية المستهلكين (P3).
 */
function templateValidationMessage(flat: {
  formErrors?: string[]
  fieldErrors?: Record<string, string[]>
}): string {
  for (const [field, msgs] of Object.entries(flat.fieldErrors ?? {})) {
    const m = msgs?.[0]
    if (!m) continue
    if (/[\u0600-\u06FF]/.test(m)) return m
    if (FIELD_AR[field]) return FIELD_AR[field]
  }
  const form = flat.formErrors?.[0]
  if (form && /[\u0600-\u06FF]/.test(form)) return form
  return 'بيانات غير صالحة — راجع الحقول المدخلة'
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params
    const body = await req.json()

    const existing = await db.notificationTemplate.findUnique({ where: { id } })
    if (!existing) {
      return notFound('القالب غير موجود')
    }

    const parsed = UpdateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      return fail(
        'VALIDATION_ERROR',
        templateValidationMessage(flat),
        422,
        flat,
        undefined,
        req.nextUrl.pathname,
      )
    }

    const data = parsed.data

    // Validate Handlebars syntax if templates are being updated
    if (data.titleTemplate) {
      try {
        Handlebars.compile(data.titleTemplate)
      } catch (e) {
        const msg = `خطأ في صيغة القالب: ${(e as Error).message}`
        return fail(
          'VALIDATION_ERROR',
          msg,
          422,
          { titleTemplate: msg },
          undefined,
          req.nextUrl.pathname,
        )
      }
    }
    if (data.bodyTemplate) {
      try {
        Handlebars.compile(data.bodyTemplate)
      } catch (e) {
        const msg = `خطأ في صيغة القالب: ${(e as Error).message}`
        return fail(
          'VALIDATION_ERROR',
          msg,
          422,
          { bodyTemplate: msg },
          undefined,
          req.nextUrl.pathname,
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.type !== undefined) updateData.type = data.type
    if (data.channel !== undefined) updateData.channel = data.channel
    if (data.titleTemplate !== undefined) updateData.titleTemplate = data.titleTemplate
    if (data.bodyTemplate !== undefined) updateData.bodyTemplate = data.bodyTemplate
    if (data.variables !== undefined) updateData.variables = data.variables
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    // Increment version on any change
    updateData.version = existing.version + 1

    const updated = await db.notificationTemplate.update({
      where: { id },
      data: updateData,
    })

    // P3: تدقيق تعديل القالب — قبل/بعد لنسخة القالب ونوعه وقناته.
    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_UPDATED',
      entity: 'notification_template',
      entityId: id,
      details: JSON.stringify({
        type: { before: existing.type, after: updated.type },
        channel: { before: existing.channel, after: updated.channel },
        versionBefore: existing.version,
        versionAfter: updated.version,
      }),
      before: {
        type: existing.type,
        channel: existing.channel,
        version: existing.version,
        isActive: existing.isActive,
      },
      after: {
        type: updated.type,
        channel: updated.channel,
        version: updated.version,
        isActive: updated.isActive,
      },
      request: req,
    })

    return ok(updated)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة القوالب للمديرين فقط')
    logger.error('[admin/templates/[id] PUT] failed:', err)
    const message = (err as Error).message || 'Failed'
    if (message.includes('Unique constraint')) {
      return fail(
        'VALIDATION_ERROR',
        'يوجد قالب نشط لنفس النوع والقناة',
        422,
        { type: 'يوجد قالب نشط لنفس النوع والقناة' },
        undefined,
        req.nextUrl.pathname,
      )
    }
    return internalError('Failed to update template')
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const existing = await db.notificationTemplate.findUnique({ where: { id } })
    if (!existing) {
      return notFound('القالب غير موجود')
    }

    // Check if this is the last active template for its type+channel
    const activeCount = await db.notificationTemplate.count({
      where: {
        type: existing.type,
        channel: existing.channel,
        isActive: true,
        id: { not: id },
      },
    })

    if (existing.isActive && activeCount === 0) {
      // رسالة الحارس بالعربية تظهر في error.message الذي تعرضه الصفحة،
      // لا في details وحدها (كانت تظهر للمستخدم "Invalid input").
      return fail(
        'VALIDATION_ERROR',
        'لا يمكن حذف آخر قالب نشط لهذا النوع والقناة',
        422,
        { isActive: 'لا يمكن حذف آخر قالب نشط لهذا النوع والقناة' },
        undefined,
        req.nextUrl.pathname,
      )
    }

    await db.notificationTemplate.delete({ where: { id } })

    // P3: تدقيق حذف القالب — قبل/بعد لحالة القالب المحذوف.
    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_DELETED',
      entity: 'notification_template',
      entityId: id,
      details: JSON.stringify({
        type: existing.type,
        channel: existing.channel,
        version: existing.version,
        isActive: existing.isActive,
      }),
      before: {
        type: existing.type,
        channel: existing.channel,
        version: existing.version,
        isActive: existing.isActive,
      },
      request: req,
    })

    return ok({ success: true })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة القوالب للمديرين فقط')
    logger.error('[admin/templates/[id] DELETE] failed:', err)
    return internalError('Failed to delete template')
  }
}
