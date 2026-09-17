import type { NextRequest } from 'next/server'
import {
  conflict,
  forbidden,
  internalError,
  notFound,
  ok,
  validationFail,
} from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { CustomTabCreateSchema } from '@/lib/validation/team'

const MAX_CUSTOM_TABS = 3

// GET /api/creator/team/custom-tabs — list custom tabs for the owned team.
// Note: hiding tabs stays admin-only; creators manage content + visibility
// of their own tabs only.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const tabs = await db.teamCustomTab.findMany({
      where: { teamId: owned.id },
      orderBy: { order: 'asc' },
    })
    return ok({ tabs, max: MAX_CUSTOM_TABS })
  } catch (err) {
    logger.error({ err }, '[creator/team/custom-tabs GET] failed')
    return internalError('فشل جلب التبويبات')
  }
}

// POST /api/creator/team/custom-tabs — add a custom tab (max 3).
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-tabs:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = CustomTabCreateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const count = await db.teamCustomTab.count({ where: { teamId: owned.id } })
    if (count >= MAX_CUSTOM_TABS) {
      return conflict('وصلت للحد الأقصى من التبويبات المخصصة (3)')
    }

    const tab = await db.teamCustomTab.create({
      data: {
        teamId: owned.id,
        title: parsed.data.title.trim(),
        content: parsed.data.content ?? '',
        visible: parsed.data.visible ?? true,
        order: count,
      },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'CUSTOM_TAB_ADDED',
        entity: 'TeamCustomTab',
        entityId: tab.id,
        details: JSON.stringify({ teamId: owned.id }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/custom-tabs] audit log failed')
    }

    return ok({ tab, message: 'تمت إضافة التبويب' }, { status: 201 })
  } catch (err) {
    logger.error({ err }, '[creator/team/custom-tabs POST] failed')
    return internalError('فشل إضافة التبويب')
  }
}
