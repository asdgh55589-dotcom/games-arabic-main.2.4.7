import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, ok } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  authErrorResponse,
  declaredVariables,
  loadTemplateForLifecycle,
  renderSampleVariables,
  validateTemplateContent,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const ValidateBodySchema = z.object({
  /** عينات مخصصة للاختبار بدل عينات المدير الافتراضية. */
  variables: z.record(z.string(), z.unknown()).optional(),
  /** حقول مسودة لتجربتها قبل الحفظ (تغطي على حقول القالب المخزّنة). */
  titleTemplate: z.string().optional(),
  bodyTemplate: z.string().optional(),
  richBodyTemplate: z.string().nullable().optional(),
  parseMode: z.enum(['HTML', 'MarkdownV2']).nullable().optional(),
})

/**
 * إجراء التحقق (#3 من 12): فحص القالب حسب قناته بقواعد المسار الرئيسي
 * (حدود 4096/256 وRTL والأحرف التحكم من validateRichDocument canonical +
 * قواعد تيليجرام: اقتران parseMode↔richBody ووسوم HTML الرسمية والوسائط
 * وبنى المسودات). صالح → 200 {ok:true}؛ خطأ → 422 برسائل عربية حقلية.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    const body = await req.json().catch(() => ({}))
    const parsed = ValidateBodySchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات غير صالحة — راجع الحقول المدخلة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    const override = parsed.data
    const result = validateTemplateContent({
      type: template.type,
      channel: template.channel,
      titleTemplate: override.titleTemplate ?? template.titleTemplate,
      bodyTemplate: override.bodyTemplate ?? template.bodyTemplate,
      richBodyTemplate:
        override.richBodyTemplate !== undefined
          ? override.richBodyTemplate
          : (template.richBodyTemplate ?? null),
      parseMode:
        override.parseMode !== undefined ? override.parseMode : (template.parseMode ?? null),
      variables: declaredVariables(template),
      samples: override.variables ?? renderSampleVariables(template.type),
    })

    if (!result.ok) {
      const firstError = result.issues.find((issue) => issue.severity === 'error')
      return fail(
        'VALIDATION_ERROR',
        firstError?.message || 'القالب غير صالح — راجع قائمة المشاكل',
        422,
        { issues: result.issues, metrics: result.metrics },
        undefined,
        req.nextUrl.pathname,
      )
    }

    return ok({
      ok: true,
      issues: result.issues, // تحذيرات فقط إن وُجدت
      metrics: result.metrics,
      channel: template.channel,
      sampleVariables: override.variables ?? renderSampleVariables(template.type),
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/validate POST] failed:', err)
    return internalError('Failed to validate template')
  }
}
