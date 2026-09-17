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
import { hashInviteToken, isInviteExpired } from '@/lib/team-invites'
import { InviteTokenSchema } from '@/lib/validation/team'

// POST /api/creator/team/transfer/accept — nominee claims ownership.
// Atomic swap: team.ownerId → nominee, old owner membership → admin,
// nominee membership → owner. Rate limited 5/hr/user.
export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) return unauthorized('يجب تسجيل الدخول أولاً')
    return unauthorized('يجب تسجيل الدخول أولاً')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 5,
    window: 3600,
    keyPrefix: `team-transfer-accept:${user.id}`,
  })
  if (limited) return limited

  try {
    const body: unknown = await req.json().catch(() => null)
    const parsed = InviteTokenSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const nomination = await db.teamInvitation.findUnique({
      where: { tokenHash: hashInviteToken(parsed.data.token) },
      include: { team: { select: { id: true, name: true, slug: true, ownerId: true } } },
    })
    if (!nomination || nomination.role !== 'owner') {
      return notFound('الترشيح غير صالح')
    }
    if (nomination.status !== 'pending') {
      return conflict('لم يعد هذا الترشيح معلقاً')
    }
    if (isInviteExpired(nomination.expiresAt)) {
      await db.teamInvitation.updateMany({
        where: { id: nomination.id, status: 'pending' },
        data: { status: 'expired' },
      })
      return validationFail('انتهت صلاحية الترشيح')
    }
    if (nomination.invitedUserId !== user.id) {
      return forbidden('هذا الترشيح موجه لعضو آخر')
    }

    const nomineeMembership = await db.teamMembership.findFirst({
      where: { teamId: nomination.teamId, userId: user.id },
      select: { id: true },
    })
    if (!nomineeMembership) {
      return conflict('لم تعد عضواً في الفريق')
    }

    const previousOwnerId = nomination.team.ownerId

    try {
      await db.$transaction(async (tx) => {
        const claimed = await tx.teamInvitation.updateMany({
          where: { id: nomination.id, status: 'pending' },
          data: { status: 'accepted', respondedAt: new Date(), respondedBy: user.id },
        })
        if (claimed.count === 0) {
          throw new Error('TRANSFER_RACE_LOST')
        }
        await tx.team.update({
          where: { id: nomination.teamId },
          data: { ownerId: user.id },
        })
        if (previousOwnerId && previousOwnerId !== user.id) {
          await tx.teamMembership.updateMany({
            where: { teamId: nomination.teamId, userId: previousOwnerId },
            data: { role: 'admin' },
          })
        }
        await tx.teamMembership.update({
          where: { id: nomineeMembership.id },
          data: { role: 'owner' },
        })
      })
    } catch (txErr) {
      if (txErr instanceof Error && txErr.message === 'TRANSFER_RACE_LOST') {
        return conflict('تم استخدام هذا الترشيح بالفعل')
      }
      throw txErr
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'OWNERSHIP_TRANSFER_COMPLETED',
        entity: 'TeamInvitation',
        entityId: nomination.id,
        details: JSON.stringify({ teamId: nomination.teamId, previousOwnerId }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/transfer] audit log failed')
    }

    for (const [targetId, title, message] of [
      [user.id, 'أصبحت مالك الفريق', `أنت الآن مالك فريق "${nomination.team.name}"`],
      ...(previousOwnerId && previousOwnerId !== user.id
        ? [[previousOwnerId, 'تم نقل ملكية الفريق', `أصبح ${user.username} مالك فريق "${nomination.team.name}" ودورك الآن إداري`]]
        : []),
    ] as Array<[string, string, string]>) {
      try {
        await db.notification.create({
          data: { userId: targetId, actorId: user.id, type: 'system_announcement', title, message, data: { teamId: nomination.teamId } },
        })
      } catch (err) {
        logger.warn({ err }, '[creator/team/transfer] notify failed')
      }
    }

    return ok({
      teamId: nomination.teamId,
      teamSlug: nomination.team.slug,
      teamName: nomination.team.name,
      message: 'تم نقل الملكية بنجاح',
    })
  } catch (err) {
    logger.error({ err }, '[creator/team/transfer/accept POST] failed')
    return internalError('فشل قبول نقل الملكية')
  }
}
