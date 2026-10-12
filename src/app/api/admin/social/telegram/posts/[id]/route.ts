/**
 * /api/admin/social/posts/[id] — تفصيل/تعديل/حذف منشور.
 *
 * GET    (requireAdmin)   — تفصيل منشور.
 * PATCH  (requireManager) — تعديل مسودة/مجدول (لا يعدّل منشوراً published).
 * DELETE (requireManager) — حذف draft/scheduled/failed/canceled فقط.
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PostPatchSchema } from '@/lib/social/post-schemas'
import { serializePost } from '@/lib/social/serialize'

const EDITABLE_STATUSES = new Set(['draft', 'scheduled', 'failed', 'canceled'])
const DELETABLE_STATUSES = new Set(['draft', 'scheduled', 'failed', 'canceled'])

const FIELD_AR: Record<string, string> = {
  platform: 'المنصة غير صالحة',
  title: 'العنوان غير صالح',
  body: 'المحتوى مطلوب',
  parseMode: 'نمط التحليل غير صالح',
  mediaUrl: 'رابط الوسائط غير صالح',
  destinationId: 'الوجهة غير صالحة',
  templateId: 'القالب غير صالح',
  botId: 'البوت غير صالح',
  richDocument: 'مواصفة الرسالة الغنية غير صالحة',
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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params

    const post = await db.socialPost.findUnique({ where: { id } })
    if (!post) return notFound('المنشور غير موجود', _req.nextUrl.pathname)

    return ok(serializePost(post as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاطلاع على المنشورات للإدارة فقط')
    logger.error('[admin/social/posts/[id] GET] failed:', err)
    return internalError('تعذّر تحميل المنشور')
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const existing = await db.socialPost.findUnique({ where: { id } })
    if (!existing) return notFound('المنشور غير موجود', req.nextUrl.pathname)

    if (!EDITABLE_STATUSES.has(existing.status)) {
      return fail(
        'CONFLICT',
        'لا يمكن تعديل منشور منشور مسبقاً — انسخه كمسودة جديدة',
        409,
        { status: existing.status },
        undefined,
        req.nextUrl.pathname,
      )
    }

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

    const parsed = PostPatchSchema.safeParse(body)
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
    if (input.title !== undefined) data.title = input.title ?? null
    if (input.body !== undefined) data.body = input.body
    if (input.parseMode !== undefined) data.parseMode = input.parseMode ?? null
    if (input.richDocument !== undefined)
      data.richDocument = (input.richDocument ?? undefined) as never
    if (input.mediaUrl !== undefined) data.mediaUrl = input.mediaUrl ?? null
    if (input.destinationId !== undefined) data.destinationId = input.destinationId ?? null
    if (input.templateId !== undefined) data.templateId = input.templateId ?? null
    if (input.botId !== undefined) data.botId = input.botId ?? null

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

    // الوجهة/القالب/البوت إن وُجدوا يجب أن يكونوا موجودين.
    if (typeof data.destinationId === 'string') {
      const destination = await db.telegramDestination.findUnique({
        where: { id: data.destinationId },
        select: { id: true },
      })
      if (!destination) {
        return fail('VALIDATION_ERROR', 'الوجهة غير موجودة', 422, {
          destinationId: 'الوجهة غير موجودة',
        })
      }
    }
    if (typeof data.templateId === 'string') {
      const template = await db.socialPostTemplate.findUnique({
        where: { id: data.templateId },
        select: { id: true },
      })
      if (!template) {
        return fail('VALIDATION_ERROR', 'القالب غير موجود', 422, { templateId: 'القالب غير موجود' })
      }
    }
    if (typeof data.botId === 'string') {
      const bot = await db.socialTelegramBot.findUnique({
        where: { id: data.botId },
        select: { id: true },
      })
      if (!bot) {
        return fail('VALIDATION_ERROR', 'البوت غير موجود', 422, { botId: 'البوت غير موجود' })
      }
    }

    const updated = await db.socialPost.update({ where: { id }, data })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'update',
      entity: 'social_post',
      entityId: id,
      details: 'تعديل منشور',
      before: { status: existing.status, title: existing.title },
      after: { status: updated.status, title: updated.title },
      request: req,
    })

    return ok(serializePost(updated as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — تعديل المنشورات للمديرين فقط')
    logger.error('[admin/social/posts/[id] PATCH] failed:', err)
    return internalError('تعذّر تعديل المنشور')
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireManager()
    const { id } = await ctx.params

    const existing = await db.socialPost.findUnique({ where: { id } })
    if (!existing) return notFound('المنشور غير موجود', req.nextUrl.pathname)

    if (!DELETABLE_STATUSES.has(existing.status)) {
      return fail(
        'CONFLICT',
        'لا يمكن حذف منشور منشور مسبقاً',
        409,
        { status: existing.status },
        undefined,
        req.nextUrl.pathname,
      )
    }

    await db.socialPost.delete({ where: { id } })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'delete',
      entity: 'social_post',
      entityId: id,
      details: 'حذف منشور',
      request: req,
    })

    return ok({ deleted: true, id })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — حذف المنشورات للمديرين فقط')
    logger.error('[admin/social/posts/[id] DELETE] failed:', err)
    return internalError('تعذّر حذف المنشور')
  }
}
