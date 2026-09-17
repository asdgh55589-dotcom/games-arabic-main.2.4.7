import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, okPaginated } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PaginationSchema } from '@/lib/schemas'

const TEAM_ACTIONS = [
  'TEAM_CREATED',
  'TEAM_UPDATED',
  'MEMBER_REMOVED',
  'ROLE_CHANGED',
  'INVITE_CREATED',
  'INVITE_REVOKED',
  'INVITE_ACCEPTED',
  'INVITE_DECLINED',
]

// GET /api/creator/team/activity — team-scoped activity feed for the owner.
// Reads the same auditLog rows the team APIs write; rows are scoped by
// entityId so a creator only ever sees their own team's events.
// IP addresses are intentionally excluded (admin-only field).
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { searchParams } = new URL(req.url)
    const parsed = PaginationSchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const page = parsed.success ? parsed.data.page : 1
    // Activity feed defaults to the last 20 events (spec); explicit limits
    // clamp to 50 (PaginationSchema allows 100 — too wide for this feed).
    const rawLimit = Number.parseInt(searchParams.get('limit') || '', 10)
    const limit =
      searchParams.has('limit') && Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 50)
        : 20

    const [memberships, invitations] = await Promise.all([
      db.teamMembership.findMany({
        where: { teamId: owned.id },
        select: { id: true },
      }),
      db.teamInvitation.findMany({
        where: { teamId: owned.id },
        select: { id: true },
      }),
    ])
    const entityIds = [owned.id, ...memberships.map((m) => m.id), ...invitations.map((i) => i.id)]

    const where = { entityId: { in: entityIds }, action: { in: TEAM_ACTIONS } }
    const [total, rows] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          username: true,
          entity: true,
          entityId: true,
          createdAt: true,
        },
      }),
    ])

    return okPaginated(rows, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    logger.error({ err }, '[creator/team/activity GET] failed')
    return internalError('فشل جلب نشاط الفريق')
  }
}
