import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { canManageTeam, getTeamRole } from '@/lib/team-permissions'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { CustomTabUpdateSchema } from '@/lib/validation/team'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/creator/team/custom-tabs/[id] — full edit of an owned-team custom tab.
// Accepts title, content (Markdown), and visible.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-custom-tabs:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'manage_tabs')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const { id } = await params
    const existing = await db.teamCustomTab.findFirst({
      where: { id, teamId: owned.id },
    })
    if (!existing) return notFound('التبويب غير موجود في فريقك')

    const body: unknown = await req.json().catch(() => null)
    const parsed = CustomTabUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }
    if (Object.keys(parsed.data).length === 0) {
      return validationFail('لا توجد حقول صالحة للتحديث')
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) data.title = parsed.data.title.trim()
    if (parsed.data.content !== undefined) data.content = parsed.data.content
    if (parsed.data.visible !== undefined) data.visible = parsed.data.visible

    const tab = await db.teamCustomTab.update({ where: { id: existing.id }, data })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'CUSTOM_TAB_UPDATED',
        entity: 'TeamCustomTab',
        entityId: tab.id,
        details: JSON.stringify({ teamId: owned.id, title: parsed.data.title, visible: parsed.data.visible }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/custom-tabs] audit log failed')
    }

    return ok({ tab, message: 'تم حفظ التغييرات' })
  } catch (err) {
    logger.error({ err }, '[creator/team/custom-tabs PATCH] failed')
    return internalError('فشل حفظ التغييرات')
  }
}

// DELETE /api/creator/team/custom-tabs/[id] — remove an owned-team custom tab.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-custom-tabs:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'manage_tabs')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const { id } = await params
    const existing = await db.teamCustomTab.findFirst({
      where: { id, teamId: owned.id },
      select: { id: true },
    })
    if (!existing) return notFound('التبويب غير موجود في فريقك')

    await db.teamCustomTab.delete({ where: { id: existing.id } })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'CUSTOM_TAB_REMOVED',
        entity: 'TeamCustomTab',
        entityId: existing.id,
        details: JSON.stringify({ teamId: owned.id }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/custom-tabs] audit log failed')
    }

    return ok({ success: true, message: 'تم حذف التبويب' })
  } catch (err) {
    logger.error({ err }, '[creator/team/custom-tabs DELETE] failed')
    return internalError('فشل حذف التبويب')
  }
}
