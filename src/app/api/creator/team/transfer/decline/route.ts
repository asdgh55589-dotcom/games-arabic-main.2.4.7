import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { hashInviteToken } from '@/lib/team-invites'
import { InviteTokenSchema } from '@/lib/validation/team'

// POST /api/creator/team/transfer/decline — nominee declines ownership.
// Binding-checked; idempotent (already-responded returns 200 with status).
export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) return unauthorized('يجب تسجيل الدخول أولاً')
    return unauthorized('يجب تسجيل الدخول أولاً')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 5,
    window: 3600,
    keyPrefix: `team-transfer-decline:${user.id}`,
  })
  if (limited) return limited

  try {
    const body: unknown = await req.json().catch(() => null)
    const parsed = InviteTokenSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const nomination = await db.teamInvitation.findUnique({
      where: { tokenHash: hashInviteToken(parsed.data.token) },
    })
    if (!nomination || nomination.role !== 'owner') {
      return notFound('الترشيح غير صالح')
    }
    if (nomination.status !== 'pending') {
      return ok({ status: nomination.status, message: 'تم تسجيل الرد مسبقاً' })
    }
    if (nomination.invitedUserId !== user.id) {
      return forbidden('هذا الترشيح موجه لعضو آخر')
    }

    await db.teamInvitation.updateMany({
      where: { id: nomination.id, status: 'pending' },
      data: { status: 'declined', respondedAt: new Date(), respondedBy: user.id },
    })

    return ok({ status: 'declined', message: 'تم رفض نقل الملكية' })
  } catch (err) {
    logger.error({ err }, '[creator/team/transfer/decline POST] failed')
    return internalError('فشل رفض نقل الملكية')
  }
}
