/**
 * /api/admin/social/telegram/templates — قوالب منشورات تليجرام.
 *
 * GET  (requireAdmin)   — قائمة القوالب.
 * POST (requireManager) — إنشاء قالب. `isDefault` واحد لكل platform.
 *
 * مسار مُحاذى مع صفحات W2 (`socialTemplatesUrl`) — لا يُعاد تسميته.
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, ok, okPaginated, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PostTemplateCreateSchema } from '@/lib/social/post-schemas'
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

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform') ?? 'telegram'
    const page = Number(searchParams.get('page') ?? '1') || 1
    const limit = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 100)

    const where = { platform }
    const [templates, total] = await Promise.all([
      db.socialPostTemplate.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.socialPostTemplate.count({ where }),
    ])

    return okPaginated(templates.map(serializeTemplate), {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاطلاع على قوالب المنشورات للإدارة فقط')
    logger.error('[admin/social/telegram/templates GET] failed:', err)
    return internalError('تعذّر تحميل قوالب المنشورات')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireManager()
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

    const parsed = PostTemplateCreateSchema.safeParse(body)
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

    // invariant: قالب افتراضي واحد لكل platform (نمط destination الواحد).
    if (input.isDefault) {
      const existingDefault = await db.socialPostTemplate.findFirst({
        where: { platform: input.platform, isDefault: true },
        select: { id: true, name: true },
      })
      if (existingDefault) {
        return fail(
          'CONFLICT',
          `يوجد قالب افتراضي بالفعل لهذا المنصة: ${existingDefault.name} — ألغِ افتراضيته أولاً`,
          409,
          { isDefault: existingDefault.id },
          undefined,
          req.nextUrl.pathname,
        )
      }
    }

    const template = await db.socialPostTemplate.create({
      data: {
        platform: input.platform,
        name: input.name,
        title: input.title ?? null,
        body: input.body,
        parseMode: input.parseMode ?? null,
        richDocument: (input.richDocument ?? undefined) as never,
        mediaUrl: input.mediaUrl ?? null,
        variables: input.variables,
        isDefault: input.isDefault,
        createdById: user.id,
      },
    })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'create',
      entity: 'social_post_template',
      entityId: template.id,
      details: `إنشاء قالب منشور: ${template.name}`,
      request: req,
    })

    return ok(serializeTemplate(template as unknown as Record<string, unknown>), { status: 201 })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إنشاء القوالب للمديرين فقط')
    logger.error('[admin/social/telegram/templates POST] failed:', err)
    return internalError('تعذّر إنشاء القالب')
  }
}
