import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendNotification } from '@/lib/notifications/service'
import { sendMessage } from '@/lib/telegram-bot'
import { destinationReadiness } from '@/lib/telegram-destinations'
import {
  authErrorResponse,
  declaredVariables,
  escapeHtmlText,
  loadTemplateForLifecycle,
  renderSampleVariables,
  renderTemplateFields,
  telegramRenderedText,
  validateTemplateContent,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const TestSendBodySchema = z.object({
  /** تيليجرام: معرّف وجهة مسجّلة إلزامي — لا إرسال لمحادثة عابرة. */
  destinationId: z.string().min(1).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
})

const READINESS_AR: Record<string, string> = {
  disabled: 'الوجهة معطّلة',
  pending: 'الوجهة بانتظار التفعيل',
  unverified: 'الوجهة غير موثّقة — وثّقها قبل الإرسال',
  failed_verification: 'فشل تحقق الوجهة السابقة',
}

/** تيليجرام: هروب HTML حين لا يوجد parseMode (sendMessage يفترض HTML افتراضياً). */
function escapePlainForTelegram(text: string): string {
  return escapeHtmlText(text)
}

/**
 * إجراء الإرسال التجريبي (#5 من 12):
 *  - تيليجرام: وجهة مسجّلة + جاهزة + تحقق من المحتوى أولاً + تسجيل message_id في التدقيق.
 *  - بريد/داخل التطبيق: إرسال للمدير المنفّذ نفسه مع skipDeduplication (لا يمس مسار الإذن).
 * موافقة البث العام requireManager موجودة في مسار الإرسال الحالي ولا تُمس هنا.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    const body = await req.json().catch(() => ({}))
    const parsed = TestSendBodySchema.safeParse(body)
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

    const samples = parsed.data.variables ?? renderSampleVariables(template.type)

    // بوابة التحقق نفسها (إجراءات #3) — لا يُرسل قالب غير صالح أبداً.
    const validation = validateTemplateContent({
      type: template.type,
      channel: template.channel,
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
      richBodyTemplate: template.richBodyTemplate ?? null,
      parseMode: template.parseMode ?? null,
      variables: declaredVariables(template),
      samples,
    })
    if (!validation.ok) {
      const firstError = validation.issues.find((issue) => issue.severity === 'error')
      return fail(
        'VALIDATION_ERROR',
        firstError?.message || 'القالب غير صالح — راجع قائمة المشاكل',
        422,
        { issues: validation.issues, metrics: validation.metrics },
        undefined,
        req.nextUrl.pathname,
      )
    }

    if (template.channel === 'telegram') {
      if (!parsed.data.destinationId) {
        const msg = 'حدّد وجهة تيليجرام مسجّلة (destinationId) — لا يُقبل إرسال لمحادثة عابرة'
        return fail(
          'VALIDATION_ERROR',
          msg,
          422,
          { destinationId: msg },
          undefined,
          req.nextUrl.pathname,
        )
      }

      const destination = await db.telegramDestination.findUnique({
        where: { id: parsed.data.destinationId },
      })
      if (!destination) {
        const msg = 'الوجهة غير موجودة في السجل'
        return fail(
          'VALIDATION_ERROR',
          msg,
          422,
          { destinationId: msg },
          undefined,
          req.nextUrl.pathname,
        )
      }

      const readiness = destinationReadiness(destination)
      if (!readiness.ready) {
        return fail(
          'CONFLICT',
          READINESS_AR[readiness.reason] ?? 'الوجهة ليست جاهزة للإرسال',
          409,
          { destinationId: READINESS_AR[readiness.reason] ?? 'الوجهة ليست جاهزة للإرسال' },
          undefined,
          req.nextUrl.pathname,
        )
      }

      const rendered = telegramRenderedText(template, samples)
      const text = template.parseMode ? rendered.text : escapePlainForTelegram(rendered.text)

      const response = await sendMessage({
        chatId: destination.chatId,
        text,
        parseMode: (template.parseMode ?? 'HTML') as 'HTML' | 'MarkdownV2',
        disablePreview: true,
      })

      if (!response.ok) {
        return fail(
          'TELEGRAM_SEND_FAILED',
          `فشل إرسال تيليجرام: ${response.description ?? 'خطأ غير معروف'}`,
          502,
          { description: response.description ?? null, errorCode: response.error_code ?? null },
          undefined,
          req.nextUrl.pathname,
        )
      }

      const messageId = (response.result as { message_id?: number } | undefined)?.message_id ?? null

      await logAction({
        userId: manager.id,
        username: manager.username,
        action: 'NOTIFICATION_TEMPLATE_TEST_SENT',
        entity: 'notification_template',
        entityId: template.id,
        details: JSON.stringify({
          channel: 'telegram',
          destinationId: destination.id,
          chatId: destination.chatId,
          messageId,
          parseMode: template.parseMode ?? null,
          metrics: validation.metrics,
        }),
        request: req,
      })

      return ok({
        delivered: true,
        channel: 'telegram',
        destinationId: destination.id,
        messageId,
        metrics: validation.metrics,
      })
    }

    // بريد / داخل التطبيق: إرسال تجريبي مُعَرَّض للمدير المنفّذ نفسه، بلا تكرار.
    const rendered = renderTemplateFields(template, samples)
    const result = await sendNotification({
      type: template.type as never,
      title: rendered.title,
      message: rendered.body,
      recipients: [{ userId: manager.id, channels: [template.channel] as never }],
      skipDeduplication: true,
      data: { templateTest: true, templateId: template.id },
    } as never)

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_TEST_SENT',
      entity: 'notification_template',
      entityId: template.id,
      details: JSON.stringify({
        channel: template.channel,
        recipient: manager.id,
        created: result.created,
        queued: result.queued,
        skipped: result.skipped,
        deduplicated: result.deduplicated,
        metrics: validation.metrics,
      }),
      request: req,
    })

    return ok({
      delivered: true,
      channel: template.channel,
      recipient: manager.id,
      counts: {
        created: result.created,
        queued: result.queued,
        skipped: result.skipped,
        deduplicated: result.deduplicated,
      },
      metrics: validation.metrics,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/test-send POST] failed:', err)
    return internalError('Failed to test-send template')
  }
}
