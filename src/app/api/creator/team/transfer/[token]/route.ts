import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { hashInviteToken, isInviteExpired } from '@/lib/team-invites'

interface RouteParams {
  // Segment is named `token` and carries the raw transfer nomination token.
  params: Promise<{ token: string }>
}

// GET /api/creator/team/transfer/[token] — ownership-nomination metadata for
// the transfer accept page (GAM-8/A5). Mirrors the invites meta shape so
// InviteAcceptClient in transfer mode fetches the transfer endpoint — not the
// regular-invites endpoint — for both meta and actions.
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
    keyPrefix: `team-transfer-meta:${user.id}`,
  })
  if (limited) return limited

  try {
    const { token } = await params
    if (!token || token.length < 20 || token.length > 100) {
      return notFound('الترشيح غير صالح أو منتهي')
    }

    const nomination = await db.teamInvitation.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { team: { select: { id: true, name: true, slug: true } } },
    })
    if (!nomination || nomination.role !== 'owner') {
      return notFound('الترشيح غير صالح أو منتهي')
    }

    // Binding first: no team name/slug/status disclosure to anyone but the
    // nominee (review follow-up on GAM-16 — stale-token meta oracle).
    if (nomination.invitedUserId !== user.id) {
      return forbidden('هذا الترشيح موجه لعضو آخر')
    }

    const base = {
      teamName: nomination.team.name,
      teamSlug: nomination.team.slug,
      role: 'owner' as const,
      expiresAt: nomination.expiresAt,
    }

    if (nomination.status === 'pending' && isInviteExpired(nomination.expiresAt)) {
      await db.teamInvitation.updateMany({
        where: { id: nomination.id, status: 'pending' },
        data: { status: 'expired' },
      })
      return ok({ ...base, status: 'expired', eligible: false, reason: 'انتهت صلاحية الترشيح' })
    }

    if (nomination.status !== 'pending') {
      return ok({ ...base, status: nomination.status, eligible: false, reason: 'لم يعد هذا الترشيح معلقاً' })
    }

    return ok({ ...base, status: 'pending', eligible: true })
  } catch (err) {
    logger.error({ err }, '[team/transfer/[token] GET] failed')
    return internalError('فشل جلب الترشيح')
  }
}
