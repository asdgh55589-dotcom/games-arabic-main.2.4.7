/**
 * /api/admin/social/posts — قائمة وإنشاء منشورات Social Hub.
 *
 * GET  (requireAdmin)   — قائمة مع فلاتر وترقيم.
 * POST (requireManager) — إنشاء مسودة (draft).
 */
import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, ok, okPaginated, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PostCreateSchema, PostListQuerySchema } from '@/lib/social/post-schemas'
import { serializePost } from '@/lib/social/serialize'

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
    if (/[\u0600-\u06FF]/.test(message)) return message
    if (FIELD_AR[field]) return FIELD_AR[field]
  }
  const form = flat.formErrors?.[0]
  if (form && /[\u0600-\u06FF]/.test(form)) return form
  return 'بيانات غير صالحة — راجع الحقول المدخلة'
}

const STATUS_VALUES = new Set([
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'canceled',
])

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    // `searchParams.get` يعيد `null` عند غياب الوسيط، و`.optional()` في zod
    // يقبل `undefined` فقط لا `null` — لذا نُطبّع القيم الغائبة إلى undefined.
    const raw = (key: string): string | undefined => searchParams.get(key) ?? undefined
    const parsedQuery = PostListQuerySchema.safeParse({
      platform: raw('platform'),
      status: raw('status'),
      from: raw('from'),
      to: raw('to'),
      page: raw('page'),
      limit: raw('limit'),
    })
    if (!parsedQuery.success) {
      return fail('VALIDATION_ERROR', 'معايير التصفية غير صالحة', 422, parsedQuery.error.flatten())
    }
    const { platform, status, from, to, page, limit } = parsedQuery.data

    const where: Record<string, unknown> = {}
    if (platform) where.platform = platform
    if (status) {
      if (!STATUS_VALUES.has(status)) {
        return fail('VALIDATION_ERROR', `حالة غير معروفة: ${status}`, 422, { status })
      }
      where.status = status
    }
    // الأرشيف صفحة مستقلة — القوائم العادية تخفي المؤرشف (الفئة 4 خطوة 5).
    where.archivedAt = null
    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)
      where.createdAt = createdAt
    }

    const [posts, total] = await Promise.all([
      db.socialPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.socialPost.count({ where }),
    ])

    return okPaginated(posts.map(serializePost), {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاطلاع على المنشورات للإدارة فقط')
    logger.error('[admin/social/posts GET] failed:', err)
    return internalError('تعذّر تحميل المنشورات')
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

    const parsed = PostCreateSchema.safeParse(body)
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

    // الوجهة/القالب إن وُجدا يجب أن يكونا موجودين (رسالة عربية واضحة).
    if (input.destinationId) {
      const destination = await db.telegramDestination.findUnique({
        where: { id: input.destinationId },
        select: { id: true },
      })
      if (!destination) {
        return fail('VALIDATION_ERROR', 'الوجهة غير موجودة', 422, {
          destinationId: 'الوجهة غير موجودة',
        })
      }
    }
    if (input.templateId) {
      const template = await db.socialPostTemplate.findUnique({
        where: { id: input.templateId },
        select: { id: true },
      })
      if (!template) {
        return fail('VALIDATION_ERROR', 'القالب غير موجود', 422, { templateId: 'القالب غير موجود' })
      }
    }
    if (input.botId) {
      const bot = await db.socialTelegramBot.findUnique({
        where: { id: input.botId },
        select: { id: true },
      })
      if (!bot) {
        return fail('VALIDATION_ERROR', 'البوت غير موجود', 422, { botId: 'البوت غير موجود' })
      }
    }

    const post = await db.socialPost.create({
      data: {
        platform: input.platform,
        status: 'draft',
        title: input.title ?? null,
        body: input.body,
        parseMode: input.parseMode ?? null,
        richDocument: (input.richDocument ?? undefined) as never,
        mediaUrl: input.mediaUrl ?? null,
        destinationId: input.destinationId ?? null,
        templateId: input.templateId ?? null,
        botId: input.botId ?? null,
        createdById: user.id,
      },
    })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'create',
      entity: 'social_post',
      entityId: post.id,
      details: 'إنشاء مسودة منشور',
      request: req,
    })

    return ok(serializePost(post as unknown as Record<string, unknown>), { status: 201 })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إنشاء المنشورات للمديرين فقط')
    logger.error('[admin/social/posts POST] failed:', err)
    return internalError('تعذّر إنشاء المنشور')
  }
}
