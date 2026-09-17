import type { NextRequest } from 'next/server'
import {
  conflict,
  forbidden,
  internalError,
  notFound,
  ok,
  validationFail,
} from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { can } from '@/lib/permissions'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { slugify } from '@/lib/utils'
import {
  CreateCreatorTeamSchema,
  UpdateCreatorTeamSchema,
} from '@/lib/validation/team'

// GET /api/creator/team — current creator's owned team + counts.
// Empty-state contract: 404 with code TEAM_NOT_FOUND when the caller owns no team.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const team = await getOwnedTeam(user.id)
    if (!team) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const [membershipCount, followsCount] = await Promise.all([
      db.teamMembership.count({ where: { teamId: team.id } }),
      db.teamFollow.count({ where: { teamId: team.id } }),
    ])

    return ok({ team, membershipCount, followsCount })
  } catch (err) {
    logger.error({ err }, '[creator/team GET] failed')
    return internalError('فشل جلب الفريق')
  }
}

// POST /api/creator/team — create one team for the current creator.
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  if (!can(user.role, 'team.create')) {
    return forbidden('لا تملك صلاحية إنشاء فريق')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 5,
    window: 3600,
    keyPrefix: `creator:team-create:${user.id}`,
  })
  if (limited) return limited

  try {
    const body: unknown = await req.json().catch(() => null)
    const parsed = CreateCreatorTeamSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const existing = await getOwnedTeam(user.id)
    if (existing) {
      return conflict('لديك فريق بالفعل — الإدارة الحالية تدعم فريقاً واحداً')
    }

    const baseSlug = slugify(parsed.data.name)
    if (!baseSlug) {
      return validationFail('تعذر إنشاء رابط للفريق من هذا الاسم')
    }
    let slug = baseSlug
    const clash = await db.team.findUnique({ where: { slug }, select: { id: true } })
    if (clash) slug = `${baseSlug}-${Date.now().toString(36)}`

    const team = await db.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          slug,
          name: parsed.data.name.trim(),
          description: parsed.data.description ?? '',
          logoUrl: parsed.data.logoUrl ?? '',
          bannerUrl: parsed.data.bannerUrl ?? '',
          websiteUrl: parsed.data.websiteUrl ?? '',
          telegramUrl: parsed.data.telegramUrl ?? '',
          ownerId: user.id,
        },
      })
      await tx.teamMembership.create({
        data: {
          teamId: created.id,
          userId: user.id,
          name: user.username,
          role: 'owner',
        },
      })
      return created
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'TEAM_CREATED',
        entity: 'Team',
        entityId: team.id,
        details: JSON.stringify({ teamId: team.id, slug: team.slug }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team] audit log failed')
    }

    return ok({ team, message: 'تم إنشاء الفريق بنجاح' }, { status: 201 })
  } catch (err) {
    logger.error({ err }, '[creator/team POST] failed')
    return internalError('فشل إنشاء الفريق')
  }
}

// PATCH /api/creator/team — update owned-team basic settings. Slug is immutable.
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  if (!can(user.role, 'team.manage')) {
    return forbidden('لا تملك صلاحية إدارة الفريق')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-edit:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = UpdateCreatorTeamSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const data: Record<string, string> = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim()
    if (parsed.data.description !== undefined) data.description = parsed.data.description
    if (parsed.data.logoUrl !== undefined) data.logoUrl = parsed.data.logoUrl ?? ''
    if (parsed.data.bannerUrl !== undefined) data.bannerUrl = parsed.data.bannerUrl ?? ''
    if (parsed.data.websiteUrl !== undefined) data.websiteUrl = parsed.data.websiteUrl ?? ''
    if (parsed.data.telegramUrl !== undefined) data.telegramUrl = parsed.data.telegramUrl ?? ''

    if (Object.keys(data).length === 0) {
      return validationFail('لا توجد حقول صالحة للتحديث')
    }

    const team = await db.team.update({ where: { id: owned.id }, data })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'TEAM_UPDATED',
        entity: 'Team',
        entityId: team.id,
        details: JSON.stringify({ teamId: team.id, fields: Object.keys(data) }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team] audit log failed')
    }

    return ok({ team, message: 'تم حفظ إعدادات الفريق' })
  } catch (err) {
    logger.error({ err }, '[creator/team PATCH] failed')
    return internalError('فشل حفظ إعدادات الفريق')
  }
}
