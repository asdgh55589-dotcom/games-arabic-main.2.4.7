import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { checkInviteBinding, hashInviteToken, isInviteExpired } from '@/lib/team-invites'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET /api/creator/team/invites/[token] — invite metadata for the accept page.
// Any authenticated user (invitees may hold the plain member role).
// Never returns token material, hashes, or full emails.
export async function GET(req: NextRequest, { params }: RouteParams) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) return unauthorized('يجب تسجيل الدخول أولاً')
    return unauthorized('يجب تسجيل الدخول أولاً')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 20,
    window: 3600,
    keyPrefix: `team-invite-meta:${user.id}`,
  })
  if (limited) return limited

  try {
    const { token } = await params
    if (!token || token.length < 20 || token.length > 100) {
      return notFound('الدعوة غير صالحة أو منتهية')
    }

    const invite = await db.teamInvitation.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { team: { select: { id: true, name: true, slug: true } } },
    })
    if (!invite) return notFound('الدعوة غير صالحة أو منتهية')

    // Lazy expiry: flip observed expired rows so lists stay truthful.
    if (invite.status === 'pending' && isInviteExpired(invite.expiresAt)) {
      await db.teamInvitation.updateMany({
        where: { id: invite.id, status: 'pending' },
        data: { status: 'expired' },
      })
      return ok({
        teamName: invite.team.name,
        teamSlug: invite.team.slug,
        role: invite.role,
        expiresAt: invite.expiresAt,
        status: 'expired',
        eligible: false,
        reason: 'انتهت صلاحية الدعوة',
      })
    }

    if (invite.status !== 'pending') {
      return ok({
        teamName: invite.team.name,
        teamSlug: invite.team.slug,
        role: invite.role,
        expiresAt: invite.expiresAt,
        status: invite.status,
        eligible: false,
        reason: 'لم تعد هذه الدعوة معلقة',
      })
    }

    const binding = checkInviteBinding(
      {
        invitedUserId: invite.invitedUserId,
        inviteeUsername: invite.inviteeUsername,
        inviteeEmail: invite.inviteeEmail,
      },
      { id: user.id, username: user.username, email: user.email },
    )
    if (!binding.ok) {
      return forbidden(binding.reason)
    }

    return ok({
      teamName: invite.team.name,
      teamSlug: invite.team.slug,
      role: invite.role,
      expiresAt: invite.expiresAt,
      status: 'pending',
      eligible: true,
    })
  } catch (err) {
    console.error('[team/invites/[token] GET] failed:', err)
    return internalError('فشل جلب الدعوة')
  }
}
