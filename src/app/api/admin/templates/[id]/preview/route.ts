import Handlebars from 'handlebars'
import type { NextRequest } from 'next/server'
import { generateEmailWrapper } from '@/infrastructure/templates/email-base'
import { forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  buildPreviewMatrix,
  renderSampleVariables,
  securityTemplateGuard,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params

    const template = await db.notificationTemplate.findUnique({ where: { id } })
    if (!template) {
      return notFound('القالب غير موجود')
    }

    // P3: قوالب الأمان لا تُعاين ولا تُعرض عبر هذه الواجهة إطلاقاً.
    const securityGuard = securityTemplateGuard(template)
    if (securityGuard) return securityGuard

    const body = await req.json().catch(() => ({}))
    const sampleVars =
      body.variables && typeof body.variables === 'object'
        ? body.variables
        : renderSampleVariables(template.type)

    const compiledTitle = Handlebars.compile(template.titleTemplate)
    const compiledBody = Handlebars.compile(template.bodyTemplate)

    const title = compiledTitle(sampleVars)
    const bodyHtml = compiledBody(sampleVars)

    let html: string | undefined
    if (template.channel === 'email') {
      html = generateEmailWrapper({
        title,
        body: bodyHtml,
        recipientName: sampleVars.recipientName as string | undefined,
        actionUrl: sampleVars.actionUrl as string | undefined,
        actionLabel: sampleVars.actionLabel as string | undefined,
      })
    }

    // P3 (additive): مصفوفة معاينة شاملة لكل أسطح القناة (إجراءات #4) —
    // الحقول القديمة أعلاه تبقى كما هي تماماً.
    const matrix = buildPreviewMatrix(template, sampleVars)

    return ok({
      title,
      body: bodyHtml,
      html,
      sampleVariables: sampleVars,
      matrix,
    })
  } catch (err) {
    // P3: فشل الصلاحية يجب أن يعود 401/403 لا 500 (كان الخطأ العام يبتلع AuthError).
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة القوالب للمديرين فقط')
    logger.error('[admin/templates/[id]/preview POST] failed:', err)
    return internalError('Failed to preview template')
  }
}
