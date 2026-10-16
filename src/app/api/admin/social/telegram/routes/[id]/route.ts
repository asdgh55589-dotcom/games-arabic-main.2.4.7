import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  checkRouteTarget,
  ROUTE_TARGET_TYPES,
} from '@/lib/social/publish-routes'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const PatchRouteSchema = z.object({
  targetType: z.enum(ROUTE_TARGET_TYPES).optional(),
  destinationId: z.string().min(1).optional(),
  botId: z.string().min(1).nullable().optional(),
  threadId: z.number().int().min(1).nullable().optional(),
  priority: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
})

const ruleInclude = {
  destination: {
    select: { id: true, chatId: true, title: true, chatType: true, status: true, archivedAt: true },
  },
  bot: { select: { id: true, label: true, status: true } },
} as const

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params

    const rule = await db.socialPublishRoute.findUnique({ where: { id }, include: ruleInclude })
    if (!rule) return notFound('القاعدة غير موجودة')

    return ok({ rule })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — قراءة التوجيه للمشرفين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/routes/[id] GET] failed:', err)
    return internalError('Failed to load publish route')
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const existing = await db.socialPublishRoute.findUnique({ where: { id } })
    if (!existing) return notFound('القاعدة غير موجودة')

    const raw = await req.json().catch(() => ({}))
    const parsed = PatchRouteSchema.safeParse(raw)
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
    const data = parsed.data

    const nextDestinationId = data.destinationId ?? existing.destinationId
    const nextTargetType = data.targetType ?? existing.targetType
    const nextThreadId = data.threadId !== undefined ? data.threadId : existing.threadId
    const nextBotId = data.botId !== undefined ? data.botId : existing.botId

    // أي تغيير على (الوجهة/النوع/الموضوع/البوت) يُعاد فحصه كاملاً.
    if (
      data.destinationId !== undefined ||
      data.targetType !== undefined ||
      data.threadId !== undefined ||
      data.botId !== undefined
    ) {
      const check = await checkRouteTarget({
        destinationId: nextDestinationId,
        targetType: nextTargetType,
        threadId: nextThreadId,
        botId: nextBotId,
      })
      if (!check.ok) {
        return fail(check.code ?? 'VALIDATION_ERROR', check.message ?? 'وجهة غير صالحة', 422, check.details, undefined, req.nextUrl.pathname)
      }
    }

    const validFrom = data.validFrom !== undefined
      ? data.validFrom ? new Date(data.validFrom) : null
      : undefined
    const validUntil = data.validUntil !== undefined
      ? data.validUntil ? new Date(data.validUntil) : null
      : undefined
    const effFrom = validFrom !== undefined ? validFrom : existing.validFrom
    const effUntil = validUntil !== undefined ? validUntil : existing.validUntil
    if (effFrom && effUntil && effFrom > effUntil) {
      const msg = 'بداية الصلاحية بعد نهايتها — راجع التاريخين'
      return fail('VALIDATION_ERROR', msg, 422, { validFrom: msg }, undefined, req.nextUrl.pathname)
    }

    if (data.isDefault === true) {
      await db.socialPublishRoute.updateMany({
        where: { platformKey: existing.platformKey, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updateData: Record<string, unknown> = {}
    if (data.targetType !== undefined) updateData.targetType = data.targetType
    if (data.destinationId !== undefined) updateData.destinationId = data.destinationId
    if (data.botId !== undefined) updateData.botId = data.botId
    if (data.threadId !== undefined) updateData.threadId = data.threadId
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (validFrom !== undefined) updateData.validFrom = validFrom
    if (validUntil !== undefined) updateData.validUntil = validUntil

    const rule = await db.socialPublishRoute.update({ where: { id }, data: updateData })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SOCIAL_ROUTE_UPDATED',
      entity: 'social_publish_route',
      entityId: id,
      details: JSON.stringify({ platformKey: rule.platformKey }),
      request: req,
    })

    return ok({ rule })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة التوجيه للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/routes/[id] PATCH] failed:', err)
    return internalError('Failed to update publish route')
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const existing = await db.socialPublishRoute.findUnique({ where: { id } })
    if (!existing) return notFound('القاعدة غير موجودة')

    await db.socialPublishRoute.delete({ where: { id } })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SOCIAL_ROUTE_DELETED',
      entity: 'social_publish_route',
      entityId: id,
      details: JSON.stringify({
        platformKey: existing.platformKey,
        destinationId: existing.destinationId,
      }),
      request: req,
    })

    return ok({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة التوجيه للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/routes/[id] DELETE] failed:', err)
    return internalError('Failed to delete publish route')
  }
}
