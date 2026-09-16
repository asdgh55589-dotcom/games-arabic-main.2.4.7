import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/creator/team/invites/[id]/revoke — revoke a pending invite. Owner only.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 30,
    window: 3600,
    keyPrefix: `creator:team-invite:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { id } = await params
    if (!id) return notFound('الدعوة غير موجودة')

    // Atomic: only a pending row in the owned team can be revoked.
    const revoked = await db.teamInvitation.updateMany({
      where: { id, teamId: owned.id, status: 'pending' },
      data: { status: 'revoked', respondedAt: new Date(), respondedBy: user.id },
    })
    if (revoked.count === 0) {
      return notFound('الدعوة غير موجودة أو لم تعد معلقة')
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'INVITE_REVOKED',
        entity: 'TeamInvitation',
        entityId: id,
        details: JSON.stringify({ teamId: owned.id }),
        request: req,
      })
    } catch (err) {
      console.error('[creator/team/invites] audit log failed:', err)
    }

    return ok({ success: true, message: 'تم إلغاء الدعوة' })
  } catch (err) {
    console.error('[creator/team/invites/revoke POST] failed:', err)
    return internalError('فشل إلغاء الدعوة')
  }
}
