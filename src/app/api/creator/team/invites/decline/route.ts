import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { checkInviteBinding, hashInviteToken } from '@/lib/team-invites'
import { InviteTokenSchema } from '@/lib/validation/team'

// POST /api/creator/team/invites/decline — authenticated invitee declines.
// Idempotent: declining an already-responded invite returns its current status.
export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) return unauthorized('يجب تسجيل الدخول أولاً')
    return unauthorized('يجب تسجيل الدخول أولاً')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `team-invite-decline:${user.id}`,
  })
  if (limited) return limited

  try {
    const body: unknown = await req.json().catch(() => null)
    const parsed = InviteTokenSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const invite = await db.teamInvitation.findUnique({
      where: { tokenHash: hashInviteToken(parsed.data.token) },
    })
    if (!invite) return notFound('الدعوة غير صالحة أو منتهية')

    if (invite.status !== 'pending') {
      return ok({ status: invite.status, message: 'تم تسجيل الرد مسبقاً' })
    }

    const binding = checkInviteBinding(
      {
        invitedUserId: invite.invitedUserId,
        inviteeUsername: invite.inviteeUsername,
        inviteeEmail: invite.inviteeEmail,
      },
      { id: user.id, username: user.username, email: user.email },
    )
    if (!binding.ok) {
      return forbidden(binding.reason)
    }

    await db.teamInvitation.updateMany({
      where: { id: invite.id, status: 'pending' },
      data: { status: 'declined', respondedAt: new Date(), respondedBy: user.id },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'INVITE_DECLINED',
        entity: 'TeamInvitation',
        entityId: invite.id,
        details: JSON.stringify({ teamId: invite.teamId }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[team/invites/decline] audit log failed')
    }

    return ok({ status: 'declined', message: 'تم رفض الدعوة' })
  } catch (err) {
    logger.error({ err }, '[team/invites/decline POST] failed')
    return internalError('فشل رفض الدعوة')
  }
}
