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
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { sanitizeUrl } from '@/lib/sanitize'
import { ContactLinkCreateSchema } from '@/lib/validation/team'

const MAX_CONTACT_LINKS = 10

// GET /api/creator/team/contacts — list contact links for the owned team.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const links = await db.teamContactLink.findMany({
      where: { teamId: owned.id },
      orderBy: { order: 'asc' },
    })
    return ok({ links, max: MAX_CONTACT_LINKS })
  } catch (err) {
    logger.error({ err }, '[creator/team/contacts GET] failed')
    return internalError('فشل جلب روابط التواصل')
  }
}

// POST /api/creator/team/contacts — add a typed contact link (max 10).
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-contacts:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = ContactLinkCreateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }
    const safeUrl = sanitizeUrl(parsed.data.url)
    if (!safeUrl) {
      return validationFail('رابط غير صالح')
    }

    const count = await db.teamContactLink.count({ where: { teamId: owned.id } })
    if (count >= MAX_CONTACT_LINKS) {
      return conflict('وصلت للحد الأقصى من روابط التواصل (10)')
    }

    const link = await db.teamContactLink.create({
      data: {
        teamId: owned.id,
        type: parsed.data.type,
        label: parsed.data.label || '',
        url: safeUrl,
        order: count,
      },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'CONTACT_LINK_ADDED',
        entity: 'TeamContactLink',
        entityId: link.id,
        details: JSON.stringify({ teamId: owned.id, type: link.type }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/contacts] audit log failed')
    }

    return ok({ link, message: 'تمت إضافة الرابط' }, { status: 201 })
  } catch (err) {
    logger.error({ err }, '[creator/team/contacts POST] failed')
    return internalError('فشل إضافة الرابط')
  }
}
