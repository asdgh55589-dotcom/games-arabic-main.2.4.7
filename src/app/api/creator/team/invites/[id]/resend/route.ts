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
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { hashInviteToken, inviteExpiryDate, buildInviteAcceptUrl } from '@/lib/team-invites'
import { InviteTokenSchema } from '@/lib/validation/team'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/creator/team/invites/[id]/resend — re-send an existing pending invite (same token).
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-invite-resend:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { id: token } = await params
    const parsed = InviteTokenSchema.safeParse({ token })
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const invite = await db.teamInvitation.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { team: { select: { id: true, name: true } } },
    })
    if (!invite || invite.teamId !== owned.id) return notFound('الدعوة غير صالحة')
    if (invite.status !== 'pending') {
      return conflict('لا يمكن إعادة إرسال دعوة غير معلقة')
    }
    if (!invite.inviteeEmail) {
      return validationFail('هذه الدعوة لا تحتوي على بريد إلكتروني لإعادة إرساله')
    }

    const acceptUrl = buildInviteAcceptUrl(token)

    try {
      const { emailProvider } = await import('@/lib/email')
      const { emailFrom } = await import('@/lib/email/from')
      const { buildInviteEmail } = await import('@/lib/email/templates')
      const built = buildInviteEmail({
        inviterUsername: user.username,
        teamName: owned.name,
        acceptUrl,
      })
      await emailProvider.send({
        from: emailFrom(),
        to: [invite.inviteeEmail],
        subject: built.subject,
        html: built.html,
      })
    } catch (err) {
      logger.error({ err }, '[team/invites/[id]/resend] email failed')
      return internalError('فشل إرسال البريد الإلكتروني')
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'INVITE_CREATED',
        entity: 'TeamInvitation',
        entityId: invite.id,
        details: JSON.stringify({ teamId: owned.id, resend: true }),
      })
    } catch {
      // best-effort audit
    }

    return ok({ message: 'تم إعادة إرسال الدعوة', acceptUrl })
  } catch (err) {
    logger.error({ err }, '[team/invites/[id]/resend POST] failed')
    return internalError('فشل إعادة الإرسال')
  }
}
