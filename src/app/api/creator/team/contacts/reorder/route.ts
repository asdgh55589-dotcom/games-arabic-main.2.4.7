import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { canManageTeam, getTeamRole } from '@/lib/team-permissions'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'

// PATCH /api/creator/team/contacts/reorder — reorder contact links by order index.
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 20,
    window: 3600,
    keyPrefix: `creator:team-contacts-reorder:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'manage_contacts')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const body: unknown = await req.json().catch(() => null)
    const ids = (body as { ids?: unknown } | null)?.ids
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string') || ids.length === 0) {
      return validationFail('ids must be a non-empty string array')
    }

    const existing = await db.teamContactLink.findMany({
      where: { teamId: owned.id },
      select: { id: true },
    })
    const existingIds = new Set(existing.map((l) => l.id))
    if (new Set(ids).size !== ids.length || ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
      return validationFail('ids do not match owned contacts')
    }

    await db.$transaction(
      ids.map((id, index) =>
        db.teamContactLink.update({ where: { id }, data: { order: index } }),
      ),
    )

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'CONTACT_LINKS_REORDERED',
        entity: 'TeamContactLink',
        entityId: owned.id,
        details: JSON.stringify({ teamId: owned.id, ids }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/contacts/reorder] audit log failed')
    }

    return ok({ success: true, message: 'تم إعادة ترتيب الروابط' })
  } catch (err) {
    logger.error({ err }, '[creator/team/contacts/reorder PATCH] failed')
    return internalError('فشل إعادة ترتيب الروابط')
  }
}
