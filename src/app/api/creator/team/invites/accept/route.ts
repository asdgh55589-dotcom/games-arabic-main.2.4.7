import type { NextRequest } from 'next/server'
import {
  conflict,
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { checkInviteBinding, hashInviteToken, isInviteExpired } from '@/lib/team-invites'
import { InviteTokenSchema } from '@/lib/validation/team'

// POST /api/creator/team/invites/accept — authenticated invitee claims the invite.
// Body: { token }. Atomic single-use claim; creates a linked TeamMembership.
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
    keyPrefix: `team-invite-accept:${user.id}`,
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
      include: { team: { select: { id: true, name: true, slug: true } } },
    })
    if (!invite) return notFound('الدعوة غير صالحة أو منتهية')

    if (invite.status !== 'pending') {
      return conflict('لم تعد هذه الدعوة معلقة')
    }

    // Ownership moves exclusively through the transfer flow (nominate →
    // accept with atomic role swap). Never mint memberships from it here.
    if (invite.role === 'owner') {
      return conflict('نقل الملكية يتم عبر صفحة الترشيح فقط')
    }

    if (isInviteExpired(invite.expiresAt)) {
      await db.teamInvitation.updateMany({
        where: { id: invite.id, status: 'pending' },
        data: { status: 'expired' },
      })
      return validationFail('انتهت صلاحية الدعوة')
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

    const alreadyMember = await db.teamMembership.findFirst({
      where: { teamId: invite.teamId, userId: user.id },
      select: { id: true },
    })
    if (alreadyMember) {
      // Close the invite (no longer actionable) but report the conflict.
      await db.teamInvitation.updateMany({
        where: { id: invite.id, status: 'pending' },
        data: { status: 'accepted', respondedAt: new Date(), respondedBy: user.id },
      })
      return conflict('أنت عضو في الفريق بالفعل')
    }

    // Atomic single-use claim: exactly one accepter can win the race.
    const claimed = await db.teamInvitation.updateMany({
      where: { id: invite.id, status: 'pending' },
      data: { status: 'accepted', respondedAt: new Date(), respondedBy: user.id },
    })
    if (claimed.count === 0) {
      return conflict('تم استخدام هذه الدعوة بالفعل')
    }

    await db.teamMembership.create({
      data: {
        teamId: invite.teamId,
        userId: user.id,
        name: user.username,
        role: invite.role,
      },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'INVITE_ACCEPTED',
        entity: 'TeamInvitation',
        entityId: invite.id,
        details: JSON.stringify({ teamId: invite.teamId, role: invite.role }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[team/invites/accept] audit log failed')
    }

    if (invite.invitedBy) {
      try {
        await db.notification.create({
          data: {
            userId: invite.invitedBy,
            actorId: user.id,
            type: 'system_announcement',
            title: 'تم قبول دعوة الفريق',
            message: `قبل ${user.username} دعوة الانضمام إلى فريق "${invite.team.name}"`,
            data: { teamId: invite.teamId, teamName: invite.team.name },
          },
        })
      } catch (err) {
        logger.warn({ err }, '[team/invites/accept] notify failed')
      }
    }

    return ok({
      teamId: invite.teamId,
      teamSlug: invite.team.slug,
      teamName: invite.team.name,
      role: invite.role,
      message: 'تم الانضمام إلى الفريق بنجاح',
    })
  } catch (err) {
    logger.error({ err }, '[team/invites/accept POST] failed')
    return internalError('فشل قبول الدعوة')
  }
}
