import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  conflict,
  fail,
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
import { handlePrismaError } from '@/lib/prisma-errors'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import {
  buildInviteAcceptUrl,
  generateInviteToken,
  hashInviteToken,
  inviteExpiryDate,
  maskEmail,
} from '@/lib/team-invites'
import { InviteCreateSchema } from '@/lib/validation/team'

const MAX_BULK = 20
const MEMBER_CAP = 50

const BulkInviteItemSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/, 'اسم مستخدم غير صالح')
      .optional(),
    email: z.string().trim().max(200).email('البريد الإلكتروني غير صالح').optional(),
    role: z
      .enum(['admin', 'moderator', 'translator', 'member', 'tester'])
      .default('member'),
  })
  .strict()
  .refine((d) => Boolean(d.username || d.email), {
    message: 'حدد اسم المستخدم أو البريد الإلكتروني',
  })
const BulkInviteSchema = z
  .object({
    invites: z.array(BulkInviteItemSchema).min(1).max(MAX_BULK),
  })
  .strict()

// POST /api/creator/team/invites/bulk — invite up to 20 users in one request.
// Returns per-email success/failure so a partial failure never blocks valid invites.
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 5,
    window: 3600,
    keyPrefix: `creator:team-invite-bulk:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = BulkInviteSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const currentCount = await db.teamMembership.count({
      where: { teamId: owned.id, status: 'active' },
    })
    const pendingCount = await db.teamInvitation.count({
      where: { teamId: owned.id, status: 'pending' },
    })
    const remainingSlots = MEMBER_CAP - currentCount - pendingCount
    if (remainingSlots <= 0) {
      return conflict('وصل الفريق للحد الأقصى من الأعضاء')
    }

    const items = parsed.data.invites.slice(0, remainingSlots)
    const results: Array<{
      invitee: string
      status: 'created' | 'skipped' | 'error'
      reason?: string
      inviteId?: string
      token?: string
      acceptUrl?: string
    }> = []

    for (const item of items) {
      const identifier = (item.username || item.email || '').toLowerCase()
      const inviteeLabel = item.username || item.email || '—'

      // Anti-enumeration: never reveal whether a username/email exists.
      let invitedUser: { id: string; username: string; email: string } | null = null
      if (item.username) {
        invitedUser = await db.user.findUnique({
          where: { username: item.username },
          select: { id: true, username: true, email: true },
        })
        if (!invitedUser) {
          results.push({ invitee: inviteeLabel, status: 'skipped', reason: 'المستخدم غير موجود أو غير مؤهل' })
          continue
        }
      } else if (item.email) {
        invitedUser = await db.user.findUnique({
          where: { email: item.email },
          select: { id: true, username: true, email: true },
        })
      }

      if (invitedUser && invitedUser.id === user.id) {
        results.push({ invitee: inviteeLabel, status: 'skipped', reason: 'لا يمكنك دعوة نفسك' })
        continue
      }

      if (invitedUser) {
        const existing = await db.teamMembership.findFirst({
          where: { teamId: owned.id, userId: invitedUser.id },
          select: { id: true },
        })
        if (existing) {
          results.push({ invitee: inviteeLabel, status: 'skipped', reason: 'عضو في الفريق بالفعل' })
          continue
        }
        const duplicate = await db.teamInvitation.findFirst({
          where: { teamId: owned.id, status: 'pending', invitedUserId: invitedUser.id },
          select: { id: true },
        })
        if (duplicate) {
          results.push({ invitee: inviteeLabel, status: 'skipped', reason: 'توجد دعوة معلقة بالفعل' })
          continue
        }
      } else if (item.email) {
        const duplicate = await db.teamInvitation.findFirst({
          where: { teamId: owned.id, status: 'pending', inviteeEmail: item.email },
          select: { id: true },
        })
        if (duplicate) {
          results.push({ invitee: inviteeLabel, status: 'skipped', reason: 'توجد دعوة معلقة لهذا البريد' })
          continue
        }
      }

      const token = generateInviteToken()
      const invite = await db.teamInvitation.create({
        data: {
          teamId: owned.id,
          invitedUserId: invitedUser?.id ?? null,
          inviteeUsername: invitedUser?.username ?? item.username ?? null,
          inviteeEmail: invitedUser?.email ?? item.email ?? null,
          role: item.role ?? 'member',
          tokenHash: hashInviteToken(token),
          status: 'pending',
          expiresAt: inviteExpiryDate(),
          invitedBy: user.id,
        },
      })

      results.push({
        invitee: inviteeLabel,
        status: 'created',
        inviteId: invite.id,
        token,
        acceptUrl: buildInviteAcceptUrl(token),
      })

      try {
        const { logAction } = await import('@/lib/audit')
        await logAction({
          userId: user.id,
          username: user.username,
          action: 'INVITE_CREATED',
          entity: 'TeamInvitation',
          entityId: invite.id,
          details: JSON.stringify({ teamId: owned.id, role: invite.role, bulk: true }),
        })
      } catch {
        // best-effort audit
      }

      const inviteeEmail = invitedUser?.email ?? item.email ?? null
      if (inviteeEmail) {
        try {
          const { emailProvider } = await import('@/lib/email')
          const { emailFrom } = await import('@/lib/email/from')
          const { buildInviteEmail } = await import('@/lib/email/templates')
          const acceptUrl = buildInviteAcceptUrl(token)
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
        } catch {
          // email is fail-open
        }
      }
    }

    const created = results.filter((r) => r.status === 'created').length
    return ok(
      {
        results,
        created,
        skipped: results.length - created,
        message: `تم إنشاء ${created} دعوة${created > 1 ? '' : ''}`,
      },
      { status: 201 },
    )
  } catch (err) {
    logger.error({ err }, '[creator/team/invites/bulk POST] failed')
    const { message, status, code } = handlePrismaError(err as Error)
    return fail(code, message, status)
  }
}
