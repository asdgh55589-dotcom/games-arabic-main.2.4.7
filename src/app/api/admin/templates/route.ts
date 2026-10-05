import Handlebars from 'handlebars'
import type { NextRequest } from 'next/server'
import {
  conflict,
  fail,
  forbidden,
  internalError,
  ok,
  okPaginated,
  unauthorized,
} from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { CreateTemplateSchema, PaginationSchema } from '@/lib/schemas'

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
 * رسالة عربية تظهر في السطر الرئيسي (error.message) لخطأ تحقق، لأن `validationFail`
 * يضع تفاصيل الحقول في details فقط ويُرجع "Invalid input" — والصفحة تعرض error.message.
 * تبقى تفاصيل الحقول كما هي في details التزاماً بعقد api-response لبقية المستهلكين.
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

export async function GET(req: NextRequest) {
  try {
    await requireManager()

    const { searchParams } = new URL(req.url)
    const parsed = PaginationSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    })
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 50 }

    const type = searchParams.get('type')
    const channel = searchParams.get('channel')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (channel) where.channel = channel

    const [templates, total] = await Promise.all([
      db.notificationTemplate.findMany({
        where,
        orderBy: [{ type: 'asc' }, { channel: 'asc' }, { version: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notificationTemplate.count({ where }),
    ])

    return okPaginated(templates, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة القوالب للمديرين فقط')
    logger.error('[admin/templates GET] failed:', err)
    return internalError('Failed to load templates')
  }
}

export async function POST(req: NextRequest) {
  try {
    const manager = await requireManager()
    const body = await req.json()

    const parsed = CreateTemplateSchema.safeParse(body)
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

    const { type, channel, titleTemplate, bodyTemplate, variables, isActive } = parsed.data

    // Validate Handlebars syntax
    try {
      Handlebars.compile(titleTemplate)
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
    try {
      Handlebars.compile(bodyTemplate)
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

    // `@@unique([type, channel])` يسمح بصف واحد فقط لكل تركيبة، و`version` عدّاد على
    // صف واحد — أي أن "سجل الإصدارات" مستحيل بنيوياً. الكتابة فوق القالب الموجود كانت
    // تمحو محتوى الإنتاج بلا تأكيد ولا أثر، لذلك نرفض بـ 409 ويوجّه المستخدم للتعديل.
    const existing = await db.notificationTemplate.findUnique({
      where: { type_channel: { type, channel } },
    })

    if (existing) {
      return conflict(
        'يوجد قالب بنفس نوع الإشعار والقناة بالفعل — عدّل القالب الموجود بدل إنشاء جديد',
      )
    }

    const template = await db.notificationTemplate.create({
      data: {
        type,
        channel,
        titleTemplate,
        bodyTemplate,
        variables,
        isActive,
        version: 1,
      },
    })

    // P3: تدقيق إنشاء القالب — كان تحرير القوالب كله بلا أي أثر في سجل النشاط،
    // بعكس مسار الإرسال الذي يسجّل NOTIFICATION_SENT منذ P1.
    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_CREATED',
      entity: 'notification_template',
      entityId: template.id,
      details: JSON.stringify({
        type,
        channel,
        version: template.version,
        isActive: template.isActive,
      }),
      after: {
        type: template.type,
        channel: template.channel,
        version: template.version,
        isActive: template.isActive,
      },
      request: req,
    })

    return ok(template)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة القوالب للمديرين فقط')
    // إغلاق نافذة السباق: طلبان متزامنان قد يتجاوزان فحص findUnique معاً،
    // فيرمي Prisma قيد التفرّد — نُرجع نفس 409 بدل 500.
    if ((err as Error)?.message?.includes('Unique constraint')) {
      return conflict(
        'يوجد قالب بنفس نوع الإشعار والقناة بالفعل — عدّل القالب الموجود بدل إنشاء جديد',
      )
    }
    logger.error('[admin/templates POST] failed:', err)
    return internalError('Failed to create template')
  }
}
