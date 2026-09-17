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
import { buildInviteAcceptUrl, generateInviteToken, hashInviteToken, inviteExpiryDate } from '@/lib/team-invites'
import { TransferNominateSchema } from '@/lib/validation/team'

const MAX_LIFETIME_NOMINATIONS = 3

// POST /api/creator/team/transfer/nominate — owner nominates a linked member
// as successor. Reuses TeamInvitation with role 'owner' (never assignable
// through the regular invite flow). One pending nomination per team, max 3
// lifetime nominations per team. Token valid 7 days.
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = TransferNominateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const member = await db.teamMembership.findFirst({
      where: { id: parsed.data.memberId, teamId: owned.id },
      include: { user: { select: { id: true, username: true, email: true } } },
    })
    if (!member) return notFound('العضو غير موجود في فريقك')
    if (!member.userId || !member.user) {
      return validationFail('لا يمكن نقل الملكية لعضو وهمي — اربطه بحساب أولاً')
    }
    if (member.userId === user.id || member.role === 'owner') {
      return validationFail('هذا العضو يملك الفريق بالفعل')
    }

    const existingPending = await db.teamInvitation.findFirst({
      where: { teamId: owned.id, role: 'owner', status: 'pending' },
      select: { id: true },
    })
    if (existingPending) {
      return conflict('توجد عملية نقل معلقة بالفعل — ألغها أولاً')
    }

    const lifetimeCount = await db.teamInvitation.count({
      where: { teamId: owned.id, role: 'owner' },
    })
    if (lifetimeCount >= MAX_LIFETIME_NOMINATIONS) {
      return conflict('تجاوزت الحد الأقصى لطلبات نقل الملكية — تواصل مع الإدارة')
    }

    const token = generateInviteToken()
    const nomination = await db.teamInvitation.create({
      data: {
        teamId: owned.id,
        invitedUserId: member.user.id,
        inviteeUsername: member.user.username,
        inviteeEmail: member.user.email,
        role: 'owner',
        tokenHash: hashInviteToken(token),
        status: 'pending',
        expiresAt: inviteExpiryDate(),
        invitedBy: user.id,
      },
    })

    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'OWNERSHIP_TRANSFER_NOMINATED',
        entity: 'TeamInvitation',
        entityId: nomination.id,
        details: JSON.stringify({ teamId: owned.id, nominee: member.user.username }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/transfer] audit log failed')
    }

    try {
      await db.notification.create({
        data: {
          userId: member.user.id,
          actorId: user.id,
          type: 'system_announcement',
          title: 'تم ترشيحك لملكية الفريق',
          message: `رشحك ${user.username} لتصبح مالك فريق "${owned.name}". اقبل أو ارفض خلال 7 أيام.`,
          data: { teamId: owned.id, teamName: owned.name, transfer: true },
        },
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/transfer] notify failed')
    }

    if (member.user.email) {
      try {
        const { emitloProvider } = await import('@/lib/email/emitlo')
        const { emailFrom } = await import('@/lib/email/from')
        await emitloProvider.send({
          from: emailFrom(),
          to: [member.user.email],
          subject: `ترشيح لملكية فريق "${owned.name}"`,
          html: `<p>مرحباً ${member.user.username}،</p><p>رشحك ${user.username} لتصبح مالك فريق "${owned.name}".</p><p><a href="${buildInviteAcceptUrl(token)}?transfer=1">مراجعة الترشيح</a> (صالح لمدة 7 أيام)</p>`,
        })
      } catch (err) {
        logger.warn({ err }, '[creator/team/transfer] email failed')
      }
    }

    return ok(
      {
        nominationId: nomination.id,
        nominee: member.user.username,
        token,
        acceptUrl: `${buildInviteAcceptUrl(token)}?transfer=1`,
        message: 'تم إنشاء الترشيح — شارك الرابط مع المرشح',
      },
      { status: 201 },
    )
  } catch (err) {
    logger.error({ err }, '[creator/team/transfer/nominate POST] failed')
    return internalError('فشل إنشاء الترشيح')
  }
}
