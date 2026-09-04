import type { NextRequest } from 'next/server'
import { fail, notFound, ok, unauthorized } from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST /api/teams/[slug]/leave — مغادرة فريق مرتبط (يدعم id أو slug)
export async function POST(req: NextRequest, { params }: RouteParams) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorized('يجب تسجيل الدخول أولاً')
    }
    return unauthorized('يجب تسجيل الدخول أولاً')
  }

  const { slug: teamIdOrSlug } = await params

  if (!teamIdOrSlug || typeof teamIdOrSlug !== 'string') {
    return fail('VALIDATION_ERROR', 'معرّف الفريق غير صالح', 422)
  }

  // Supports both teamId (cuid) and slug — try id first then slug
  let team = await db.team.findUnique({
    where: { id: teamIdOrSlug },
    select: { id: true, name: true, ownerId: true },
  })
  if (!team) {
    team = await db.team.findFirst({
      where: { slug: teamIdOrSlug },
      select: { id: true, name: true, ownerId: true },
    })
  }
  if (!team) return notFound('الفريق غير موجود')

  const teamId = team.id

  // Find the user's membership in this team
  const membership = await db.teamMembership.findFirst({
    where: {
      teamId,
      userId: user.id,
    },
  })

  if (!membership) {
    return notFound('أنت لست عضواً في هذا الفريق')
  }

  // Prevent leaving if user is the team owner
  if (team.ownerId === user.id) {
    return fail(
      'VALIDATION_ERROR',
      'لا يمكنك مغادرة الفريق لأنك المالك. يجب نقل الملكية أولاً قبل المغادرة.',
      422,
    )
  }

  const oldUsername = user.username

  await db.teamMembership.update({
    where: { id: membership.id },
    data: { userId: null },
  })

  try {
    const { logAction } = await import('@/lib/audit')
    await logAction({
      userId: user.id,
      username: oldUsername,
      action: 'TEAM_LEFT',
      entity: 'TeamMembership',
      entityId: membership.id,
      details: JSON.stringify({
        teamId,
        teamName: team.name,
        username: oldUsername,
      }),
    })
  } catch (err) {
    console.error('[LeaveTeam] Failed to log action:', err)
  }

  if (team.ownerId) {
    try {
      await db.notification.create({
        data: {
          userId: team.ownerId,
          actorId: user.id,
          type: 'system_announcement',
          title: '👤 عضو غادر الفريق',
          message: `${oldUsername} غادر فريق "${team.name}"`,
          data: { teamId, teamName: team.name } as never,
        },
      })
    } catch (e) {
      console.error('[LeaveTeam] Failed to notify owner:', e)
    }
  }

  return ok({ message: 'تم مغادرة الفريق بنجاح' } as never)
}
