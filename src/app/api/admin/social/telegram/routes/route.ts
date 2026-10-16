import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { conflict, fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAdmin, requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  checkRouteTarget,
  PLATFORM_KEYS,
  ROUTE_TARGET_TYPES,
} from '@/lib/social/publish-routes'
import { authErrorResponse } from '@/lib/template-lifecycle'

const CreateRouteSchema = z.object({
  platformKey: z.string().min(1),
  targetType: z.enum(ROUTE_TARGET_TYPES),
  destinationId: z.string().min(1),
  botId: z.string().min(1).nullable().optional(),
  threadId: z.number().int().min(1).nullable().optional(),
  priority: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
})

/**
 * GET — مصفوفة قواعد منصة (platformKey؟) مع الوجهة والبوت. قراءة admin.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const platformKey = searchParams.get('platformKey') ?? undefined

    const rules = await db.socialPublishRoute.findMany({
      where: platformKey ? { platformKey } : {},
      include: {
        destination: {
          select: { id: true, chatId: true, title: true, chatType: true, status: true, archivedAt: true },
        },
        bot: { select: { id: true, label: true, status: true } },
      },
      orderBy: [{ platformKey: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
    })

    return ok({ rules, total: rules.length })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — قراءة التوجيه للمشرفين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/routes GET] failed:', err)
    return internalError('Failed to load publish routes')
  }
}

/**
 * POST — قاعدة توجيه جديدة (manager). الوجهة من الموثقة حصراً عملياً:
 * مرفوضة إن مؤرشفة، والنوع متوافق، والبوت موجود.
 */
export async function POST(req: NextRequest) {
  try {
    const manager = await requireManager()

    const raw = await req.json().catch(() => ({}))
    const parsed = CreateRouteSchema.safeParse(raw)
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

    if (!PLATFORM_KEYS.has(data.platformKey)) {
      const msg = `منصة غير معروفة — استخدم إحدى: ${[...PLATFORM_KEYS].join('، ')}`
      return fail('VALIDATION_ERROR', msg, 422, { platformKey: msg }, undefined, req.nextUrl.pathname)
    }

    if (data.validFrom && data.validUntil && data.validFrom > data.validUntil) {
      const msg = 'بداية الصلاحية بعد نهايتها — راجع التاريخين'
      return fail('VALIDATION_ERROR', msg, 422, { validFrom: msg }, undefined, req.nextUrl.pathname)
    }

    const check = await checkRouteTarget({
      destinationId: data.destinationId,
      targetType: data.targetType,
      threadId: data.threadId,
      botId: data.botId,
    })
    if (!check.ok) {
      return fail(check.code ?? 'VALIDATION_ERROR', check.message ?? 'وجهة غير صالحة', 422, check.details, undefined, req.nextUrl.pathname)
    }

    const duplicate = await db.socialPublishRoute.findFirst({
      where: {
        platformKey: data.platformKey,
        destinationId: data.destinationId,
        threadId: data.threadId ?? null,
      },
      select: { id: true },
    })
    if (duplicate) {
      return conflict('هذه الوجهة مربوطة بهذه المنصة أصلاً — عدّل القاعدة بدل التكرار')
    }

    if (data.isDefault === true) {
      await db.socialPublishRoute.updateMany({
        where: { platformKey: data.platformKey, isDefault: true },
        data: { isDefault: false },
      })
    }

    const rule = await db.socialPublishRoute.create({
      data: {
        platformKey: data.platformKey,
        targetType: data.targetType,
        destinationId: data.destinationId,
        botId: data.botId ?? null,
        threadId: data.threadId ?? null,
        priority: data.priority ?? 0,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        createdById: manager.id,
      },
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SOCIAL_ROUTE_CREATED',
      entity: 'social_publish_route',
      entityId: rule.id,
      details: JSON.stringify({
        platformKey: rule.platformKey,
        targetType: rule.targetType,
        destinationId: rule.destinationId,
      }),
      request: req,
    })

    return ok({ rule })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة التوجيه للمديرين فقط')
    if (auth) return auth
    if ((err as Error)?.message?.includes('Unique constraint')) {
      return conflict('هذه الوجهة مربوطة بهذه المنصة أصلاً — عدّل القاعدة بدل التكرار')
    }
    logger.error('[admin/social/telegram/routes POST] failed:', err)
    return internalError('Failed to create publish route')
  }
}
