import type { NextRequest } from 'next/server'
import { conflict, forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { syncTeamCounts } from '@/lib/team-helpers'
import { ModLinkSchema } from '@/lib/validation/team'

// POST /api/creator/team/mods/link — link one of the caller's OWN mods to
// the owned team. Owner-only. Rejects foreign mods (claim guard) and
// already-linked mods. Rate limited 10/hr.
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-modlink:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = ModLinkSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const mod = await db.mod.findUnique({
      where: { id: parsed.data.modId },
      select: { id: true, authorId: true, teamId: true, name: true },
    })
    if (!mod) return notFound('التعريب غير موجود')
    if (mod.authorId !== user.id) {
      return forbidden('يمكنك ربط تعريباتك الخاصة فقط')
    }
    if (mod.teamId === owned.id) {
      return conflict('هذا التعريب مرتبط بفريقك بالفعل')
    }
    if (mod.teamId) {
      return conflict('هذا التعريب مرتبط بفريق آخر — ألغِ ربطه أولاً')
    }

    await db.mod.update({ where: { id: mod.id }, data: { teamId: owned.id } })
    try {
      await syncTeamCounts(owned.id)
    } catch (err) {
      logger.warn({ err }, '[creator/team/mods/link] count sync failed')
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'MOD_LINKED_TO_TEAM',
        entity: 'Mod',
        entityId: mod.id,
        details: JSON.stringify({ teamId: owned.id, modName: mod.name }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/mods/link] audit log failed')
    }

    return ok({ success: true, message: 'تم ربط التعريب بالفريق' })
  } catch (err) {
    logger.error({ err }, '[creator/team/mods/link POST] failed')
    return internalError('فشل ربط التعريب')
  }
}
