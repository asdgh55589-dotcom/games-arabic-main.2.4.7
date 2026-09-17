import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, okPaginated, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { PaginationSchema } from '@/lib/schemas'
import { UpdateMemberRoleSchema } from '@/lib/validation/team'

// GET /api/creator/team/members — read-only member list for the owned team.
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
    const limit = Math.min(parsed.success ? parsed.data.limit : 24, 100)

    const [total, rows] = await Promise.all([
      db.teamMembership.count({ where: { teamId: owned.id } }),
      db.teamMembership.findMany({
        where: { teamId: owned.id },
        orderBy: { joinedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      }),
    ])

    const members = rows.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user?.displayName || m.user?.username || m.name,
      username: m.user?.username ?? null,
      avatarUrl: m.user?.avatarUrl ?? m.avatarUrl,
      role: m.role,
      isLinked: Boolean(m.userId),
      joinedAt: m.joinedAt,
    }))

    return okPaginated(members, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    logger.error({ err }, '[creator/team/members GET] failed')
    return internalError('فشل جلب أعضاء الفريق')
  }
}

// PATCH /api/creator/team/members — change a member's role. Owner only.
// Body: { memberId, role } — role 'owner' is never assignable here.
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 30,
    window: 3600,
    keyPrefix: `creator:team-members:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = UpdateMemberRoleSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const member = await db.teamMembership.findFirst({
      where: { id: parsed.data.memberId, teamId: owned.id },
    })
    if (!member) return notFound('العضو غير موجود في فريقك')

    if (member.userId === user.id) {
      return validationFail('لا يمكنك تغيير دورك من هنا')
    }
    if (!member.userId) {
      return validationFail('لا يمكن تغيير دور عضو وهمي — اربطه بحساب أولاً')
    }

    const updated = await db.teamMembership.update({
      where: { id: member.id },
      data: { role: parsed.data.role },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'ROLE_CHANGED',
        entity: 'TeamMembership',
        entityId: member.id,
        details: JSON.stringify({ teamId: owned.id, before: member.role, after: parsed.data.role }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/members] audit log failed')
    }

    if (member.userId) {
      try {
        await db.notification.create({
          data: {
            userId: member.userId,
            actorId: user.id,
            type: 'system_announcement',
            title: 'تم تحديث دورك في الفريق',
            message: `أصبح دورك الآن "${parsed.data.role}" في الفريق`,
            data: { teamId: owned.id, role: parsed.data.role },
          },
        })
      } catch (err) {
        logger.warn({ err }, '[creator/team/members] notify failed')
      }
    }

    return ok({ member: updated, message: 'تم تحديث دور العضو' })
  } catch (err) {
    logger.error({ err }, '[creator/team/members PATCH] failed')
    return internalError('فشل تحديث دور العضو')
  }
}

// DELETE /api/creator/team/members?memberId= — remove a member. Owner only.
// Phantom-preserving: sets userId to null instead of deleting the row.
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 30,
    window: 3600,
    keyPrefix: `creator:team-members:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')?.trim() || ''
    if (!memberId) {
      return validationFail('memberId مطلوب')
    }

    const member = await db.teamMembership.findFirst({
      where: { id: memberId, teamId: owned.id },
    })
    if (!member) return notFound('العضو غير موجود في فريقك')

    if (member.userId === user.id || member.role === 'owner') {
      return validationFail('لا يمكنك إزالة مالك الفريق — انقل الملكية أولاً')
    }

    await db.teamMembership.update({
      where: { id: member.id },
      data: { userId: null },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'MEMBER_REMOVED',
        entity: 'TeamMembership',
        entityId: member.id,
        details: JSON.stringify({ teamId: owned.id }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/members] audit log failed')
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
        logger.warn({ err }, '[creator/team/members] notify failed')
      }
    }

    return ok({ success: true, message: 'تمت إزالة العضو' })
  } catch (err) {
    logger.error({ err }, '[creator/team/members DELETE] failed')
    return internalError('فشل إزالة العضو')
  }
}
