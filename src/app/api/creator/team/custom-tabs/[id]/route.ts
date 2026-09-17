import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { CustomTabUpdateSchema } from '@/lib/validation/team'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/creator/team/custom-tabs/[id] — update an owned-team custom tab.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

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

    const data: Record<string, string | boolean> = {}
    if (parsed.data.title !== undefined) data.title = parsed.data.title.trim()
    if (parsed.data.content !== undefined) data.content = parsed.data.content
    if (parsed.data.visible !== undefined) data.visible = parsed.data.visible

    const tab = await db.teamCustomTab.update({ where: { id: existing.id }, data })
    return ok({ tab, message: 'تم حفظ التبويب' })
  } catch (err) {
    logger.error({ err }, '[creator/team/custom-tabs PATCH] failed')
    return internalError('فشل حفظ التبويب')
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
    keyPrefix: `creator:team-tabs:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

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
