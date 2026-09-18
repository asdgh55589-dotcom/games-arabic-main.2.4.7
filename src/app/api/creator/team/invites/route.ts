import type { NextRequest } from 'next/server'
import {
  conflict,
  forbidden,
  internalError,
  notFound,
  ok,
  okPaginated,
  validationFail,
} from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { PaginationSchema } from '@/lib/schemas'
import {
  buildInviteAcceptUrl,
  generateInviteToken,
  hashInviteToken,
  inviteExpiryDate,
  maskEmail,
} from '@/lib/team-invites'
import { InviteCreateSchema } from '@/lib/validation/team'

const MEMBER_CAP = 50

function toPublicRow(invite: {
  id: string
  inviteeUsername: string | null
  inviteeEmail: string | null
  role: string
  status: string
  expiresAt: Date
  createdAt: Date
  respondedAt: Date | null
}) {
  return {
    id: invite.id,
    inviteeUsername: invite.inviteeUsername,
    inviteeEmailMasked: invite.inviteeEmail ? maskEmail(invite.inviteeEmail) : null,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    respondedAt: invite.respondedAt,
  }
}

// GET /api/creator/team/invites — list invites for the owned team. Owner only.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')?.trim() || 'pending'
    const parsed = PaginationSchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const page = parsed.success ? parsed.data.page : 1
    const limit = Math.min(parsed.success ? parsed.data.limit : 24, 100)

    // Ownership-transfer nominations (role 'owner') live in their own UI
    // surface and are hidden here to avoid mixing token flows.
    const where: Record<string, unknown> =
      status === 'all'
        ? { teamId: owned.id, role: { not: 'owner' } }
        : { teamId: owned.id, status, role: { not: 'owner' } }

    const [total, rows] = await Promise.all([
      db.teamInvitation.count({ where }),
      db.teamInvitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return okPaginated(rows.map(toPublicRow), {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    logger.error({ err }, '[creator/team/invites GET] failed')
    return internalError('فشل جلب الدعوات')
  }
}

// POST /api/creator/team/invites — invite a user by username or email. Owner only.
// Returns the raw token ONCE — it is never returned again by any endpoint.
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:team-invite:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const body: unknown = await req.json().catch(() => null)
    const parsed = InviteCreateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }
    const { username, email, role } = parsed.data

    // Anti-harassment: 3 invites/hour per invitee identifier.
    const identifier = (username || email || '').toLowerCase()
    const identifierLimited = await rateLimitMiddleware(req, {
      limit: 3,
      window: 3600,
      keyPrefix: `creator:team-invite-to:${identifier}`,
    })
    if (identifierLimited) return identifierLimited

    // Resolve the invitee when possible (username is authoritative).
    let invitedUser: { id: string; username: string; email: string } | null = null
    if (username) {
      invitedUser = await db.user.findUnique({
        where: { username },
        select: { id: true, username: true, email: true },
      })
      if (!invitedUser) return notFound('المستخدم غير موجود')
    } else if (email) {
      invitedUser = await db.user.findUnique({
        where: { email },
        select: { id: true, username: true, email: true },
      })
    }

    if (invitedUser && invitedUser.id === user.id) {
      return validationFail('لا يمكنك دعوة نفسك')
    }

    // Already a linked member?
    if (invitedUser) {
      const existing = await db.teamMembership.findFirst({
        where: { teamId: owned.id, userId: invitedUser.id },
        select: { id: true },
      })
      if (existing) {
        return conflict('هذا المستخدم عضو في الفريق بالفعل')
      }
    }

    const memberCount = await db.teamMembership.count({ where: { teamId: owned.id } })
    if (memberCount >= MEMBER_CAP) {
      return conflict('وصل الفريق للحد الأقصى من الأعضاء')
    }

    // Duplicate pending invite?
    const pendingWhere: Record<string, unknown> = { teamId: owned.id, status: 'pending' }
    if (invitedUser) pendingWhere.invitedUserId = invitedUser.id
    else if (email) pendingWhere.inviteeEmail = email
    const duplicate = await db.teamInvitation.findFirst({
      where: pendingWhere,
      select: { id: true },
    })
    if (duplicate) {
      return conflict('توجد دعوة معلقة بالفعل لهذا المستخدم')
    }

    const token = generateInviteToken()
    const invite = await db.teamInvitation.create({
      data: {
        teamId: owned.id,
        invitedUserId: invitedUser?.id ?? null,
        inviteeUsername: invitedUser?.username ?? username ?? null,
        inviteeEmail: invitedUser?.email ?? email ?? null,
        role,
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
        action: 'INVITE_CREATED',
        entity: 'TeamInvitation',
        entityId: invite.id,
        details: JSON.stringify({ teamId: owned.id, role }),
        request: req,
      })
    } catch (err) {
      logger.warn({ err }, '[creator/team/invites] audit log failed')
    }

    // Fail-open side effects: in-app notification + email (never block the 201).
    const inviteeEmail = invitedUser?.email ?? email ?? null
    if (invitedUser) {
      try {
        await db.notification.create({
          data: {
            userId: invitedUser.id,
            actorId: user.id,
            type: 'system_announcement',
            title: 'دعوة للانضمام إلى فريق',
            message: `دعاك ${user.username} للانضمام إلى فريق "${owned.name}" بدور ${role}`,
            data: { teamId: owned.id, teamName: owned.name, inviteId: invite.id, role },
          },
        })
      } catch (err) {
        logger.warn({ err }, '[creator/team/invites] notify failed')
      }
    }
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
      } catch (err) {
        logger.warn({ err }, '[creator/team/invites] email failed')
      }
    }

    return ok(
      { invite: toPublicRow(invite), token, acceptUrl: buildInviteAcceptUrl(token), message: 'تم إنشاء الدعوة' },
      { status: 201 },
    )
  } catch (err) {
    logger.error({ err }, '[creator/team/invites POST] failed')
    return internalError('فشل إنشاء الدعوة')
  }
}
