import type { NextRequest } from 'next/server'
import { z } from 'zod'
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

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/creator/team/members/[memberId]/leave — member leaves their own team.
// Non-owner only; cannot leave if sole owner (must transfer ownership first).
export async function POST(req: NextRequest, { params }: RouteParams) {
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
    keyPrefix: `team-member-leave:${user.id}`,
  })
  if (limited) return limited

  try {
    const { id: memberId } = await params

    const member = await db.teamMembership.findUnique({
      where: { id: memberId },
      include: { team: { select: { id: true, name: true, ownerId: true } } },
    })
    if (!member) return notFound('العضو غير موجود')
    if (member.teamId && member.userId !== user.id) {
      return forbidden('لا يمكنك مغادرة فريق نيابة عن عضو آخر')
    }
    if (!member.userId) {
      return validationFail('لا يمكن للعضو الوهمي مغادرة الفريق')
    }
    if (member.team.ownerId === user.id) {
      return validationFail('لا يمكن للمالك مغادرة الفريق — انقل الملكية أولاً')
    }

    // Prevent leaving a team with no other active members (orphaned team).
    const siblingCount = await db.teamMembership.count({
      where: { teamId: member.teamId, status: 'active', id: { not: memberId } },
    })
    if (siblingCount === 0) {
      return validationFail('أنت العضو الأخير في الفريق — انقل الملكية قبل المغادرة')
    }

    await db.teamMembership.update({
      where: { id: memberId },
      data: { status: 'left', leftAt: new Date(), userId: null },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'MEMBER_REMOVED',
        entity: 'TeamMembership',
        entityId: memberId,
        details: JSON.stringify({ teamId: member.teamId, teamName: member.team.name, selfLeave: true }),
      })
    } catch {
      // best-effort audit
    }

    return ok({ success: true, message: 'لقد غادرت الفريق' })
  } catch (err) {
    logger.error({ err }, '[team/members/[id]/leave POST] failed')
    return internalError('فشل مغادرة الفريق')
  }
}
