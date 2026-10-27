import type { NextRequest } from 'next/server'
import { conflict, fail, forbidden, internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { canManageTeam, getTeamRole } from '@/lib/team-permissions'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handlePrismaError } from '@/lib/prisma-errors'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function handle(req: NextRequest, memberId: string) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 30,
    window: 3600,
    keyPrefix: `creator:team-members-link:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'manage_members')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const body: unknown = await req.json().catch(() => null)
    const schema = z.object({
      userId: z.string().optional(),
      username: z.string().optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return validationFail(parsed.error.flatten())

    let targetUserId = parsed.data.userId?.trim()
    if (!targetUserId && parsed.data.username) {
      const u = await db.user.findFirst({
        where: { username: { equals: parsed.data.username.trim(), mode: 'insensitive' } },
        select: { id: true },
      })
      if (!u) return notFound('المستخدم غير موجود')
      targetUserId = u.id
    }
    if (!targetUserId) return validationFail('يجب اختيار حساب للربط')

    const member = await db.teamMembership.findFirst({
      where: { id: memberId, teamId: owned.id },
    })
    if (!member) return notFound('العضو غير موجود في فريقك')
    if (member.userId !== null) return conflict('هذا العضو مرتبط بالفعل بحساب')

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, avatarUrl: true, displayName: true },
    })
    if (!targetUser) return notFound('المستخدم المستهدف غير موجود')

    const existingLink = await db.teamMembership.findFirst({
      where: { teamId: owned.id, userId: targetUserId, id: { not: memberId } },
    })
    if (existingLink) return conflict('هذا الحساب مرتبط بالفعل بعضو آخر في نفس الفريق')

    try {
      await db.teamMembership.update({
        where: { id: memberId },
        data: {
          userId: targetUserId,
          ghostName: null,
          ghostEmail: null,
          ghostAvatarUrl: null,
          ghostBio: null,
          role: 'member',
        },
      })
    } catch (error: unknown) {
      const e = error as { code?: string }
      if (e.code === 'P2002') return conflict('هذا الحساب مرتبط بالفعل بعضو آخر في نفس الفريق')
      throw error
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'TEAM_MEMBER_LINKED',
        entity: 'TeamMembership',
        entityId: memberId,
        details: JSON.stringify({ teamId: owned.id, linkedUserId: targetUserId, linkedUsername: targetUser.username }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/members/link] audit log failed')
    }

    try {
      await db.notification.create({
        data: {
          userId: targetUserId,
          actorId: user.id,
          type: 'system_announcement',
          title: '🎉 تم إضافتك لفريق!',
          message: `تم ربطك بفريق "${owned.name}" كعضو.`,
          data: { teamId: owned.id, teamName: owned.name } as never,
        },
      })
    } catch (e) {
      logger.error('[LinkMember] Failed to send notification:', e)
    }

    return ok({ message: 'تم ربط العضو بالحساب بنجاح', member: { id: memberId, userId: targetUserId, user: targetUser } })
  } catch (err) {
    logger.error({ err }, '[creator/team/members/link] failed')
    const { message, status, code } = handlePrismaError(err)
    return fail(code, message, status)
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: memberId } = await params
  return handle(req, memberId)
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id: memberId } = await params
  return handle(req, memberId)
}
