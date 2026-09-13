import type { NextRequest } from 'next/server'
import { conflict, forbidden, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>
}

// POST: ربط عضو وهمي بحساب حقيقي
export async function POST(req: NextRequest, { params }: RouteParams) {
  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) return unauthorized('يجب تسجيل الدخول')
      if (err.status === 403) return forbidden('ليس لديك صلاحية للربط')
    }
    return unauthorized('يجب تسجيل الدخول')
  }
  const { id: teamId, memberId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return validationFail('بيانات غير صالحة')
  }

  const { userId } = body as { userId?: string }

  if (!userId || typeof userId !== 'string') {
    return validationFail('يجب اختيار حساب للربط')
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  })
  if (!team) return notFound('الفريق غير موجود')

  const member = await db.teamMembership.findUnique({
    where: { id: memberId },
  })
  if (!member) return notFound('العضو غير موجود')
  if (member.teamId !== teamId) {
    return notFound('العضو لا ينتمي لهذا الفريق')
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatarUrl: true },
  })
  if (!targetUser) return notFound('المستخدم المستهدف غير موجود')

  const existingLink = await db.teamMembership.findFirst({
    where: {
      teamId,
      userId,
      id: { not: memberId },
    },
  })
  if (existingLink) {
    return conflict('هذا الحساب مرتبط بالفعل بعضو آخر في نفس الفريق')
  }

  try {
    await db.teamMembership.update({
      where: { id: memberId },
      data: { userId },
    })
  } catch (error: unknown) {
    const e = error as { code?: string }
    if (e.code === 'P2002') {
      return conflict('هذا الحساب مرتبط بالفعل بعضو آخر في نفس الفريق')
    }
    throw error
  }

  try {
    const { logAction } = await import('@/lib/audit')
    await logAction({
      userId: admin.id,
      username: (admin as unknown as { username?: string }).username || 'admin',
      action: 'TEAM_MEMBER_LINKED',
      entity: 'TeamMembership',
      entityId: memberId,
      details: JSON.stringify({
        teamId,
        teamName: team.name,
        phantomName: member.name,
        linkedUserId: userId,
        linkedUsername: targetUser.username,
      }),
    })
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort operation

  try {
    await db.notification.create({
      data: {
        userId,
        actorId: admin.id,
        type: 'system_announcement',
        title: '🎉 تم إضافتك لفريق!',
        message: `تم ربطك بفريق "${team.name}" كعضو. يمكنك مغادرة الفريق في أي وقت من صفحة "فرقي" في بروفايلك.`,
        data: { teamId, teamName: team.name } as never,
      },
    })
  } catch (e) {
    console.error('[LinkMember] Failed to send notification:', e)
  }

  return ok({
    message: 'تم ربط العضو بالحساب بنجاح',
    member: {
      ...member,
      userId,
      user: targetUser,
    },
  } as never)
}

// DELETE: إلغاء ربط عضو (العودة لوهمي)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) return unauthorized('يجب تسجيل الدخول')
      if (err.status === 403) return forbidden('ليس لديك صلاحية لإلغاء الربط')
    }
    return unauthorized('يجب تسجيل الدخول')
  }
  const { id: teamId, memberId } = await params

  const member = await db.teamMembership.findUnique({
    where: { id: memberId },
    include: {
      team: { select: { id: true, name: true } },
      user: { select: { id: true, username: true } },
    },
  })
  if (!member) return notFound('العضو غير موجود')
  if (member.teamId !== teamId) {
    return notFound('العضو لا ينتمي لهذا الفريق')
  }
  if (!member.userId) {
    return validationFail('هذا العضو غير مرتبط بحساب حقيقي')
  }

  const oldUserId = member.userId
  const oldUsername = member.user?.username

  await db.teamMembership.update({
    where: { id: memberId },
    data: { userId: null },
  })

  try {
    const { logAction } = await import('@/lib/audit')
    await logAction({
      userId: admin.id,
      username: (admin as unknown as { username?: string }).username || 'admin',
      action: 'TEAM_MEMBER_UNLINKED',
      entity: 'TeamMembership',
      entityId: memberId,
      details: JSON.stringify({
        teamId,
        teamName: member.team.name,
        previousUserId: oldUserId,
        previousUsername: oldUsername,
        phantomName: member.name,
      }),
    })
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort operation

  if (oldUserId) {
    try {
      await db.notification.create({
        data: {
          userId: oldUserId,
          type: 'system_announcement',
          title: 'ℹ️ تم إلغاء ربطك من فريق',
          message: `تم إلغاء ربط حسابك من فريق "${member.team.name}" بواسطة الإدارة.`,
          data: { teamId, teamName: member.team.name } as never,
        },
      })
    } catch (e) {
      console.error('[UnlinkMember] Failed to send notification:', e)
    }
  }

  return ok({ message: 'تم إلغاء ربط العضو بنجاح' } as never)
}
