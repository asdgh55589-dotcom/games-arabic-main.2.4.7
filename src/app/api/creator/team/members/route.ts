import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, okPaginated, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { canManageTeam, getTeamRole } from '@/lib/team-permissions'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handlePrismaError } from '@/lib/prisma-errors'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { PaginationSchema } from '@/lib/schemas'
import { AssignableTeamRoleSchema, UpdateMemberRoleSchema } from '@/lib/validation/team'
import { z } from 'zod'

// GET /api/creator/team/members — read-only member list for the owned team.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 60,
    window: 60,
    keyPrefix: `creator:team-members-list:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'view_dashboard')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const { searchParams } = new URL(req.url)
    const parsed = PaginationSchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const page = parsed.success ? parsed.data.page : 1
    const limit = Math.min(parsed.success ? parsed.data.limit : 24, 100)

    const search = (searchParams.get('search') || '').trim()
    const roleFilter = (searchParams.get('role') || '').trim()
    const statusFilter = (searchParams.get('status') || '').trim()

    const where: Record<string, unknown> = { teamId: owned.id }
    if (statusFilter && statusFilter !== 'all') where.status = statusFilter
    if (roleFilter) where.role = roleFilter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { user: { displayName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [total, rows] = await Promise.all([
      db.teamMembership.count({ where }),
      db.teamMembership.findMany({
        where,
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
      ghostName: m.ghostName,
      ghostEmail: m.ghostEmail,
      name: m.user?.displayName || m.user?.username || m.name,
      username: m.user?.username ?? null,
      avatarUrl: m.user?.avatarUrl ?? m.avatarUrl,
      role: m.role,
      status: m.status,
      leftAt: m.leftAt,
      isLinked: Boolean(m.userId),
      joinedAt: m.joinedAt,
    }))

    return okPaginated(members, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    }, { headers: { 'Cache-Control': 'private, max-age=30' } })
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

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'change_role')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

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
    const { message, status, code } = handlePrismaError(err)
    return fail(code, message, status)
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

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'remove_member')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

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

    // Removal semantics: soft-remove keeps the row (and its audit history) but
    // marks it inactive and unlinks the account. Ghost rows can be hard-deleted
    // later via the admin delete endpoint.
    await db.teamMembership.update({
      where: { id: member.id },
      data: {
        status: 'removed',
        leftAt: new Date(),
        userId: null,
      },
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
    const { message, status, code } = handlePrismaError(err)
    return fail(code, message, status)
  }
}
