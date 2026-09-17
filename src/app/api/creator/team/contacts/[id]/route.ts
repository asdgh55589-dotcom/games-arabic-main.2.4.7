import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { sanitizeUrl } from '@/lib/sanitize'
import { ContactLinkUpdateSchema } from '@/lib/validation/team'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/creator/team/contacts/[id] — update an owned-team contact link.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { id } = await params
    const existing = await db.teamContactLink.findFirst({
      where: { id, teamId: owned.id },
    })
    if (!existing) return notFound('الرابط غير موجود في فريقك')

    const body: unknown = await req.json().catch(() => null)
    const parsed = ContactLinkUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }
    if (Object.keys(parsed.data).length === 0) {
      return validationFail('لا توجد حقول صالحة للتحديث')
    }

    const data: Record<string, string> = {}
    if (parsed.data.type !== undefined) data.type = parsed.data.type
    if (parsed.data.label !== undefined) data.label = parsed.data.label
    if (parsed.data.url !== undefined) {
      const safeUrl = sanitizeUrl(parsed.data.url)
      if (!safeUrl) return validationFail('رابط غير صالح')
      data.url = safeUrl
    }

    const link = await db.teamContactLink.update({ where: { id: existing.id }, data })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'CONTACT_LINK_UPDATED',
        entity: 'TeamContactLink',
        entityId: link.id,
        details: JSON.stringify({ teamId: owned.id }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/contacts] audit log failed')
    }

    return ok({ link, message: 'تم حفظ الرابط' })
  } catch (err) {
    logger.error({ err }, '[creator/team/contacts PATCH] failed')
    return internalError('فشل حفظ الرابط')
  }
}

// DELETE /api/creator/team/contacts/[id] — remove an owned-team contact link.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params
    const existing = await db.teamContactLink.findFirst({
      where: { id, teamId: owned.id },
      select: { id: true },
    })
    if (!existing) return notFound('الرابط غير موجود في فريقك')

    await db.teamContactLink.delete({ where: { id: existing.id } })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'CONTACT_LINK_REMOVED',
        entity: 'TeamContactLink',
        entityId: existing.id,
        details: JSON.stringify({ teamId: owned.id }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/contacts] audit log failed')
    }

    return ok({ success: true, message: 'تم حذف الرابط' })
  } catch (err) {
    logger.error({ err }, '[creator/team/contacts DELETE] failed')
    return internalError('فشل حذف الرابط')
  }
}
