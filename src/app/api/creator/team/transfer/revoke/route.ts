import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'

// POST /api/creator/team/transfer/revoke — owner revokes the pending
// ownership nomination (at most one can exist per team). Owner-only.
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-transfer:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const revoked = await db.teamInvitation.updateMany({
      where: { teamId: owned.id, role: 'owner', status: 'pending' },
      data: { status: 'revoked', respondedAt: new Date(), respondedBy: user.id },
    })
    if (revoked.count === 0) {
      return notFound('لا يوجد ترشيح معلق')
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'OWNERSHIP_TRANSFER_REVOKED',
        entity: 'Team',
        entityId: owned.id,
        details: JSON.stringify({ teamId: owned.id }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/transfer] audit log failed')
    }

    return ok({ success: true, message: 'تم إلغاء الترشيح' })
  } catch (err) {
    logger.error({ err }, '[creator/team/transfer/revoke POST] failed')
    return internalError('فشل إلغاء الترشيح')
  }
}
