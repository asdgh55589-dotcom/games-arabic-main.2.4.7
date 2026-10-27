import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { canManageTeam, getTeamRole } from '@/lib/team-permissions'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handlePrismaError } from '@/lib/prisma-errors'
import { rateLimitMiddleware } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 30,
    window: 3600,
    keyPrefix: `creator:team-members-delete:${user.id}`,
  })
  if (limited) return limited

  try {
    const { id: memberId } = await params
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'remove_member')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const member = await db.teamMembership.findFirst({
      where: { id: memberId, teamId: owned.id },
    })
    if (!member) return notFound('العضو غير موجود في فريقك')

    if (member.userId === user.id || member.role === 'owner') {
      return validationFail('لا يمكنك إزالة مالك الفريق — انقل الملكية أولاً')
    }

    if (!member.userId) {
      // Ghost row: hard delete.
      await db.teamMembership.delete({ where: { id: member.id } })
    } else {
      await db.teamMembership.update({
        where: { id: member.id },
        data: { status: 'removed', leftAt: new Date(), userId: null },
      })
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'MEMBER_REMOVED',
        entity: 'TeamMembership',
        entityId: member.id,
        details: JSON.stringify({ teamId: owned.id, ghost: !member.userId }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/members/[id] DELETE] audit log failed')
    }

    if (member.userId) {
      try {
        await db.notification.create({
          data: {
            userId: member.userId,
            actorId: user.id,
            type: 'system_announcement',
            title: 'تمت إزالتك من الفريق',
            message: 'تمت إزالتك من الفريق من قبل المالك',
            data: { teamId: owned.id },
          },
        })
      } catch (err) {
        logger.warn({ err }, '[creator/team/members/[id] DELETE] notify failed')
      }
    }

    return ok({ success: true, message: 'تمت إزالة العضو' })
  } catch (err) {
    logger.error({ err }, '[creator/team/members/[id] DELETE] failed')
    const { message, status, code } = handlePrismaError(err)
    return fail(code, message, status)
  }
}
