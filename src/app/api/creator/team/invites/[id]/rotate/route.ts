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
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryDate,
  buildInviteAcceptUrl,
} from '@/lib/team-invites'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/creator/team/invites/[id]/rotate — issue a new token for a pending invite.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-invite-rotate:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { id: token } = await params
    const parsed = z.string().min(20).max(100).safeParse(token)
    if (!parsed.success) {
      return validationFail('رمز الدعوة غير صالح')
    }

    const invite = await db.teamInvitation.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { team: { select: { id: true, name: true } } },
    })
    if (!invite || invite.teamId !== owned.id) return notFound('الدعوة غير صالحة')
    if (invite.status !== 'pending') {
      return conflict('لا يمكن إعادة تفعيل دعوة غير معلقة')
    }

    const newToken = generateInviteToken()
    const updated = await db.teamInvitation.update({
      where: { id: invite.id },
      data: {
        tokenHash: hashInviteToken(newToken),
        expiresAt: inviteExpiryDate(),
      },
    })

    const inviteeEmail = updated.inviteeEmail
    if (inviteeEmail) {
      try {
        const { emailProvider } = await import('@/lib/email')
        const { emailFrom } = await import('@/lib/email/from')
        const { buildInviteEmail } = await import('@/lib/email/templates')
        const acceptUrl = buildInviteAcceptUrl(newToken)
        const built = buildInviteEmail({
          inviterUsername: user.username,
          teamName: owned.name,
          acceptUrl,
        })
        await emailProvider.send({
          from: emailFrom(),
          to: [inviteeEmail],
          subject: built.subject,
          html: built.html,
        })
      } catch (err) {
        logger.error({ err }, '[team/invites/[id]/rotate] email failed')
        return internalError('فشل إرسال البريد الإلكتروني')
      }
    }

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'INVITE_CREATED',
        entity: 'TeamInvitation',
        entityId: updated.id,
        details: JSON.stringify({ teamId: owned.id, rotate: true }),
      })
    } catch {
      // best-effort audit
    }

    return ok({
      message: 'تم تجديد رمز الدعوة',
      token: newToken,
      acceptUrl: buildInviteAcceptUrl(newToken),
      expiresAt: updated.expiresAt,
    })
  } catch (err) {
    logger.error({ err }, '[team/invites/[id]/rotate POST] failed')
    return internalError('فشل تجديد الدعوة')
  }
}
