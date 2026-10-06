import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getVariableContract } from '@/domain/rich-text'
import { fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  authErrorResponse,
  contractSamplesFor,
  declaredVariables,
  loadTemplateForLifecycle,
  snapshotTemplateVersion,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const VariablesPutSchema = z.object({
  variables: z.array(z.string().min(1)).max(50),
  changeNote: z.string().trim().max(500).optional(),
})

/**
 * إجراء المتغيرات (#12 من 12):
 *  - GET: العقد canonical للنوع + المتغيرات المُعلنة + عينات المدير +
 *    مؤشرات أمان HTML لكل عيّنة (عرض صفحة/حقول القالب).
 *  - PUT: تعديل قائمة المتغيرات المُعلنة — يرفض أي متغير خارج العقد بـ 422
 *    (نفس منطق validate: unknown_variable خطأ)، يرفع الإصدار + لقطة + تدقيق.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    const contract = getVariableContract(template.type)
    const { samples, htmlSafety } = contractSamplesFor(template.type)

    return ok({
      type: template.type,
      channel: template.channel,
      declared: declaredVariables(template),
      contract: contract ? [...contract] : [],
      contractKnown: Boolean(contract),
      samples,
      htmlSafety,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/variables GET] failed:', err)
    return internalError('Failed to load template variables')
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    const raw = await req.json().catch(() => ({}))
    const parsed = VariablesPutSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'قائمة المتغيرات غير صالحة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }

    // العقد canonical سلطة — متغير خارجه خطأ 422 لا تحذير.
    const contract = getVariableContract(template.type)
    if (contract) {
      const known = new Set(contract.map((definition) => definition.name))
      const unknown = parsed.data.variables.filter((name) => !known.has(name))
      if (unknown.length > 0) {
        const msg = `متغيرات خارج العقد: ${unknown.join(', ')}`
        return fail(
          'VALIDATION_ERROR',
          msg,
          422,
          { variables: msg, unknown },
          undefined,
          req.nextUrl.pathname,
        )
      }
    }

    const updated = await db.notificationTemplate.update({
      where: { id },
      data: {
        variables: parsed.data.variables,
        version: template.version + 1,
      },
    })

    await snapshotTemplateVersion(updated, {
      changedBy: manager.id,
      changeNote: parsed.data.changeNote ?? 'تحديث قائمة المتغيرات',
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_VARIABLES_UPDATED',
      entity: 'notification_template',
      entityId: id,
      details: JSON.stringify({
        before: declaredVariables(template),
        after: parsed.data.variables,
        version: updated.version,
      }),
      request: req,
    })

    return ok(updated)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/variables PUT] failed:', err)
    return internalError('Failed to update template variables')
  }
}
