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
import { AuthError, requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { handlePrismaError } from '@/lib/prisma-errors'

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>
}

const MemberPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    role: z.enum(['owner', 'admin', 'moderator', 'translator', 'member', 'tester']).optional(),
    avatarUrl: z.string().trim().url().optional().nullable(),
    bio: z.string().trim().max(500).optional().nullable(),
  })
  .strict()

async function audit(action: string, entityId: string, details: Record<string, unknown>) {
  try {
    const { logAction } = await import('@/lib/audit')
    await logAction({
      userId: 'admin',
      username: 'admin',
      action,
      entity: 'TeamMembership',
      entityId,
      details: JSON.stringify(details),
    })
  } catch {
    // best-effort audit
  }
}

// PATCH /api/admin/teams/[teamId]/members/[memberId] — update a member (admin).
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  let moderator: Awaited<ReturnType<typeof requireModerator>>
  try {
    moderator = await requireModerator()
  } catch (err) {
    if (err instanceof AuthError) {
      if ((err as AuthError).status === 401) return unauthorized('يجب تسجيل الدخول')
      if ((err as AuthError).status === 403)
        return forbidden('ليس لديك صلاحية لتعديل العضو')
    }
    return unauthorized('يجب تسجيل الدخول')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 30,
    window: 3600,
    keyPrefix: `admin:team-member-patch:${moderator.id}`,
  })
  if (limited) return limited

  try {
    const { id: teamId, memberId } = await params
    const body: unknown = await req.json().catch(() => null)
    const parsed = MemberPatchSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const member = await db.teamMembership.findFirst({
      where: { id: memberId, teamId },
    })
    if (!member) return notFound('العضو غير موجود في هذا الفريق')

    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.role !== undefined) data.role = parsed.data.role
    if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio

    if (Object.keys(data).length === 0) {
      return validationFail('لا توجد حقول للتحديث')
    }

    const updated = await db.teamMembership.update({
      where: { id: memberId },
      data,
    })

    await audit('ROLE_CHANGED', memberId, { teamId, memberId, changes: data })

    return ok(updated)
  } catch (err) {
    logger.error('[admin/teams/[id]/members/[memberId] PATCH] failed:', err)
    const { message, status, code } = handlePrismaError(err as Error)
    return fail(code, message, status)
  }
}

// DELETE /api/admin/teams/[teamId]/members/[memberId] — soft-remove a member (admin).
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let moderator: Awaited<ReturnType<typeof requireModerator>>
  try {
    moderator = await requireModerator()
  } catch (err) {
    if (err instanceof AuthError) {
      if ((err as AuthError).status === 401) return unauthorized('يجب تسجيل الدخول')
      if ((err as AuthError).status === 403)
        return forbidden('ليس لديك صلاحية لحذف العضو')
    }
    return unauthorized('يجب تسجيل الدخول')
  }

  const limited = await rateLimitMiddleware(req, {
    limit: 30,
    window: 3600,
    keyPrefix: `admin:team-member-delete:${moderator.id}`,
  })
  if (limited) return limited

  try {
    const { id: teamId, memberId } = await params

    const member = await db.teamMembership.findFirst({
      where: { id: memberId, teamId },
      select: { id: true, role: true, status: true, userId: true },
    })
    if (!member) return notFound('العضو غير موجود في هذا الفريق')
    if (member.role === 'owner') {
      return validationFail('لا يمكن حذف مالك الفريق — انقل الملكية أولاً')
    }
    if (member.status === 'removed') {
      return conflict('العضو محذوف مسبقاً')
    }

    await db.teamMembership.update({
      where: { id: memberId },
      data: { status: 'removed', leftAt: new Date(), userId: null },
    })

    await audit('MEMBER_REMOVED', memberId, { teamId, memberId })

    return ok({ success: true, message: 'تمت إزالة العضو' })
  } catch (err) {
    logger.error('[admin/teams/[id]/members/[memberId] DELETE] failed:', err)
    return internalError('فشل إزالة العضو')
  }
}
