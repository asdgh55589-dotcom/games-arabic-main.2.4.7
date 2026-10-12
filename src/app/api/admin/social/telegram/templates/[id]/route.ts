/**
 * /api/admin/social/telegram/templates/[id] — تفصيل/تعديل/حذف قالب منشور.
 *
 * GET    (requireAdmin)   — تفصيل قالب.
 * PATCH  (requireManager) — تعديل. `isDefault` يفحص نصف التعارض.
 * DELETE (requireManager) — حذف (يُمنع حذف الافتراضي الوحيد بلا بديل؟ — يُسمح،
 *                           القالب ليس مفتاحاً أجنبياً مقيّداً).
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PostTemplatePatchSchema } from '@/lib/social/post-schemas'
import { serializeTemplate } from '@/lib/social/serialize'

const FIELD_AR: Record<string, string> = {
  platform: 'المنصة غير صالحة',
  name: 'اسم القالب مطلوب',
  title: 'العنوان غير صالح',
  body: 'محتوى القالب مطلوب',
  parseMode: 'نمط التحليل غير صالح',
  mediaUrl: 'رابط الوسائط غير صالح',
  variables: 'قائمة المتغيرات غير صالحة',
  isDefault: 'قيمة الافتراضي غير صالحة',
  richDocument: 'مواصفة الرسائل الغنية غير صالحة',
}

function arabicValidationMessage(flat: {
  formErrors?: string[]
  fieldErrors?: Record<string, string[]>
}): string {
  for (const [field, msgs] of Object.entries(flat.fieldErrors ?? {})) {
    const message = msgs?.[0]
    if (!message) continue
    if (/[؀-ۿ]/.test(message)) return message
    if (FIELD_AR[field]) return FIELD_AR[field]
  }
  const form = flat.formErrors?.[0]
  if (form && /[؀-ۿ]/.test(form)) return form
  return 'بيانات غير صالحة — راجع الحقول المدخلة'
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params

    const template = await db.socialPostTemplate.findUnique({ where: { id } })
    if (!template) return notFound('القالب غير موجود', req.nextUrl.pathname)

    return ok(serializeTemplate(template as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاطلاع على القوالب للإدارة فقط')
    logger.error('[admin/social/telegram/templates/[id] GET] failed:', err)
    return internalError('تعذّر تحميل القالب')
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const existing = await db.socialPostTemplate.findUnique({ where: { id } })
    if (!existing) return notFound('القالب غير موجود', req.nextUrl.pathname)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return fail(
        'VALIDATION_ERROR',
        'جسم الطلب غير صالح',
        422,
        undefined,
        undefined,
        req.nextUrl.pathname,
      )
    }

    const parsed = PostTemplatePatchSchema.safeParse(body)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      return fail(
        'VALIDATION_ERROR',
        arabicValidationMessage(flat),
        422,
        flat,
        undefined,
        req.nextUrl.pathname,
      )
    }

    const input = parsed.data
    const data: Record<string, unknown> = {}
    if (input.platform !== undefined) data.platform = input.platform
    if (input.name !== undefined) data.name = input.name
    if (input.title !== undefined) data.title = input.title ?? null
    if (input.body !== undefined) data.body = input.body
    if (input.parseMode !== undefined) data.parseMode = input.parseMode ?? null
    if (input.richDocument !== undefined)
      data.richDocument = (input.richDocument ?? undefined) as never
    if (input.mediaUrl !== undefined) data.mediaUrl = input.mediaUrl ?? null
    if (input.variables !== undefined) data.variables = input.variables
    if (input.isDefault !== undefined) data.isDefault = input.isDefault

    if (Object.keys(data).length === 0) {
      return fail(
        'VALIDATION_ERROR',
        'لا توجد حقول للتعديل',
        422,
        undefined,
        undefined,
        req.nextUrl.pathname,
      )
    }

    // invariant: قالب افتراضي واحد لكل platform.
    if (data.isDefault === true) {
      const platform = (data.platform as string) ?? existing.platform
      const other = await db.socialPostTemplate.findFirst({
        where: { platform, isDefault: true, NOT: { id } },
        select: { id: true, name: true },
      })
      if (other) {
        return fail(
          'CONFLICT',
          `يوجد قالب افتراضي بالفعل لهذا المنصة: ${other.name} — ألغِ افتراضيته أولاً`,
          409,
          { isDefault: other.id },
          undefined,
          req.nextUrl.pathname,
        )
      }
    }

    const updated = await db.socialPostTemplate.update({ where: { id }, data })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'update',
      entity: 'social_post_template',
      entityId: id,
      details: `تعديل قالب منشور: ${updated.name}`,
      request: req,
    })

    return ok(serializeTemplate(updated as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — تعديل القوالب للمديرين فقط')
    logger.error('[admin/social/telegram/templates/[id] PATCH] failed:', err)
    return internalError('تعذّر تعديل القالب')
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const existing = await db.socialPostTemplate.findUnique({ where: { id } })
    if (!existing) return notFound('القالب غير موجود', req.nextUrl.pathname)

    await db.socialPostTemplate.delete({ where: { id } })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'delete',
      entity: 'social_post_template',
      entityId: id,
      details: `حذف قالب منشور: ${existing.name}`,
      request: req,
    })

    return ok({ deleted: true, id })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — حذف القوالب للمديرين فقط')
    logger.error('[admin/social/telegram/templates/[id] DELETE] failed:', err)
    return internalError('تعذّر حذف القالب')
  }
}
