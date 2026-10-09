import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { conflict, fail, forbidden, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { NotificationChannelSchema, NotificationTypeSchema } from '@/lib/schemas'
import {
  authErrorResponse,
  isSecurityTemplateType,
  loadTemplateForLifecycle,
  SECURITY_TEMPLATE_FORBIDDEN,
  snapshotTemplateVersion,
} from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const CloneBodySchema = z.object({
  type: NotificationTypeSchema.optional(),
  channel: NotificationChannelSchema.optional(),
  titleTemplate: z.string().min(1).optional(),
  bodyTemplate: z.string().min(1).optional(),
  richBodyTemplate: z.string().nullable().optional(),
  parseMode: z.enum(['HTML', 'MarkdownV2']).nullable().optional(),
  variables: z.array(z.string()).optional(),
  changeNote: z.string().trim().max(500).optional(),
})

/**
 * إجراء النسخ (#1 من 12): قالب جديد باسم/قناة مختلفين، يبدأ مسودة
 * (isActive:false) — لا يُصدَّر ولا يُرسل حتى يُفعَّل عبر إجراء التفعيل.
 * الحارس: الوجهة نفسها أمان → 403، والهدف محجوز → 409، والمصدر غير موجود → 404.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const loaded = await loadTemplateForLifecycle(id)
    if (loaded.response) return loaded.response
    const source = loaded.template

    const body = await req.json().catch(() => ({}))
    const parsed = CloneBodySchema.safeParse(body)
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

    const targetType = parsed.data.type ?? source.type
    const targetChannel = parsed.data.channel ?? source.channel

    // الهدف أمان؟ (مثلاً نسخ قالب عادي إلى نوع أمان) — 403 قبل أي كتابة.
    if (isSecurityTemplateType(targetType)) {
      return forbidden(SECURITY_TEMPLATE_FORBIDDEN)
    }

    if (targetType === source.type && targetChannel === source.channel) {
      const msg = 'يجب أن يختلف القالب المقلَّد في نوعه أو قناته — الهدف الحالي محجوز بالمصدر'
      return fail('VALIDATION_ERROR', msg, 422, { type: msg }, undefined, req.nextUrl.pathname)
    }

    const existing = await db.notificationTemplate.findUnique({
      where: { type_channel: { type: targetType, channel: targetChannel } },
    })
    if (existing) {
      return conflict('يوجد قالب بنفس نوع الإشعار والقناة بالفعل — اختر تركيبة أخرى')
    }

    const clone = await db.notificationTemplate.create({
      data: {
        type: targetType,
        channel: targetChannel,
        titleTemplate: parsed.data.titleTemplate ?? source.titleTemplate,
        bodyTemplate: parsed.data.bodyTemplate ?? source.bodyTemplate,
        richBodyTemplate:
          parsed.data.richBodyTemplate !== undefined
            ? parsed.data.richBodyTemplate
            : (source.richBodyTemplate ?? null),
        parseMode:
          parsed.data.parseMode !== undefined ? parsed.data.parseMode : (source.parseMode ?? null),
        variables:
          parsed.data.variables ?? (Array.isArray(source.variables) ? source.variables : []),
        isActive: false, // مسودة دائماً — التفعيل إجراء منفصل
        version: 1,
      },
    })

    await snapshotTemplateVersion(clone, {
      changedBy: manager.id,
      changeNote: parsed.data.changeNote ?? `نسخ من قالب ${source.type}/${source.channel}`,
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'NOTIFICATION_TEMPLATE_CLONED',
      entity: 'notification_template',
      entityId: clone.id,
      details: JSON.stringify({
        sourceId: source.id,
        sourceType: source.type,
        sourceChannel: source.channel,
        targetType: clone.type,
        targetChannel: clone.channel,
        asDraft: true,
      }),
      request: req,
    })

    return ok(clone)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return auth
    if ((err as Error)?.message?.includes('Unique constraint')) {
      return conflict('يوجد قالب بنفس نوع الإشعار والقناة بالفعل — اختر تركيبة أخرى')
    }
    logger.error('[admin/templates/[id]/clone POST] failed:', err)
    return internalError('Failed to clone template')
  }
}
