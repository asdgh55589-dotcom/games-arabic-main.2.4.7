import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/creator/team/transfer — pending ownership nomination status.
// Owner-only. Transfer nominations live in TeamInvitation with role 'owner'
// and are hidden from the regular invites list.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const pending = await db.teamInvitation.findFirst({
      where: { teamId: owned.id, role: 'owner', status: 'pending' },
      select: {
        id: true,
        inviteeUsername: true,
        expiresAt: true,
        createdAt: true,
      },
    })
    return ok({ pending })
  } catch (err) {
    logger.error({ err }, '[creator/team/transfer GET] failed')
    return internalError('فشل جلب حالة النقل')
  }
}
