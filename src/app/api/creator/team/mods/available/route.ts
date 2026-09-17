import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/creator/team/mods/available — the caller's own mods that are not
// linked to any team (link candidates). Owner-only. Read-only; no rate limit.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const mods = await db.mod.findMany({
      where: { authorId: user.id, teamId: null },
      select: { id: true, name: true, slug: true, workflowStatus: true, downloads: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return ok({ mods })
  } catch (err) {
    logger.error({ err }, '[creator/team/mods/available GET] failed')
    return internalError('فشل جلب التعريبات المتاحة')
  }
}
