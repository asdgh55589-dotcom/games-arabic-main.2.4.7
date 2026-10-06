import Handlebars from 'handlebars'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { conflict, fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  authErrorResponse,
  loadTemplateForLifecycle,
  renderSampleVariables,
  snapshotTemplateVersion,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const ImportBodySchema = z.object({
  template: z.object({
    titleTemplate: z.string().min(1),
    bodyTemplate: z.string().min(1),
    richBodyTemplate: z.string().nullable().optional(),
    parseMode: z.enum(['HTML', 'MarkdownV2']).nullable().optional(),
    variables: z.array(z.string()).optional(),
  }),
  changeNote: z.string().trim().max(500).optional(),
})

/**
 * إجراء الاستيراد (#10 من 12): يستورد حقول المحتوى إلى قالب موجود،
 * ويُلزم أن يكون مسودة (isActive:false) — القوالب النشطة ترفض الاستيراد
 * بـ 409 (لا كتابة فوق إنتاج صامت). يهبط دائماً كمسودة محفوظة + لقطة + تدقيق.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const template = loaded.template

    if (template.isActive) {
      return conflict('لا يمكن الاستيراد في قالب نشط — حوّله إلى مسودة أولاً ثم استورد')
    }

    const raw = await req.json().catch(() => ({}))
    const parsed = ImportBodySchema.safeParse(raw)
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

    const incoming = parsed.data.template

    // Handlebars يجب أن يقبل المحتوى المستورد قبل الكتابة — عرض فعلي
    // (compile وحده كسول ولن يكشف أخطاء التحليل مثل {{#if غير مغلق).
    const renderSamples = renderSampleVariables(template.type)
    const compileTargets: Array<[string, string]> = [
      ['titleTemplate', incoming.titleTemplate],
      ['bodyTemplate', incoming.bodyTemplate],
    ]
    if (incoming.richBodyTemplate) {
      compileTargets.push(['richBodyTemplate', incoming.richBodyTemplate])
    }
    for (const [field, source] of compileTargets) {
      try {
        Handlebars.compile(source)(renderSamples)
      } catch (e) {
        const msg = `خطأ في صيغة ${field}: ${(e as Error).message}`
        return fail('VALIDATION_ERROR', msg, 422, { [field]: msg }, undefined, req.nextUrl.pathname)
      }
    }

    const updated = await db.notificationTemplate.update({
      where: { id },
      data: {
        titleTemplate: incoming.titleTemplate,
        bodyTemplate: incoming.bodyTemplate,
        richBodyTemplate:
          incoming.richBodyTemplate !== undefined
            ? incoming.richBodyTemplate
            : (template.richBodyTemplate ?? null),
        parseMode:
          incoming.parseMode !== undefined ? incoming.parseMode : (template.parseMode ?? null),
        ...(incoming.variables !== undefined ? { variables: incoming.variables } : {}),
        // الاستيراد يهبط كمسودة دائماً — النشر إجراء منفصل.
        isActive: false,
        version: template.version + 1,
      },
    })

    await snapshotTemplateVersion(updated, {
      changedBy: manager.id,
      changeNote: parsed.data.changeNote ?? 'استيراد محتوى قالب',
      strict: true,
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_IMPORTED',
      entity: 'notification_template',
      entityId: id,
      details: JSON.stringify({
        fromVersion: template.version,
        toVersion: updated.version,
        type: updated.type,
        channel: updated.channel,
        landedAsDraft: true,
      }),
      request: req,
    })

    return ok(updated)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    logger.error('[admin/templates/[id]/import POST] failed:', err)
    return internalError('Failed to import template')
  }
}
