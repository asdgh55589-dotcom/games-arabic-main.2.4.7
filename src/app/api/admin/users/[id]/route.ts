import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, invalidateUserSessions, type UserRole } from '@/lib/auth'
import { logUserAction } from '@/lib/audit'
import { ok, forbidden, internalError, notFound } from '@/lib/api-response'

// Role assignment restrictions (hierarchy: member < creator < publisher < moderator < admin < manager < owner):
// - Admin can assign: member, creator, publisher, moderator
// - Manager can assign: member, creator, publisher, moderator, admin
// - Owner can assign: all roles including owner
function canAssignRole(actorRole: UserRole, targetRole: string): boolean {
  if (actorRole === 'owner') return true
  if (actorRole === 'manager') return ['member', 'creator', 'publisher', 'moderator', 'admin'].includes(targetRole)
  if (actorRole === 'admin') return ['member', 'creator', 'publisher', 'moderator'].includes(targetRole)
  return false
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/users/[id] — تفاصيل المستخدم
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        role: true,
        tier: true,
        specialRoles: true,
        bannedUntil: true,
        banStatus: true,
        banReason: true,
        bannedBy: true,
        bannedAt: true,
        lastLoginAt: true,
        loginCount: true,
        emailVerified: true,
        joinedAt: true,
        createdAt: true,
        _count: { select: { mods: true, comments: true, endorsements: true } },
      },
    })

    if (!user) {
      return notFound('User not found')
    }

    // آخر 50 إجراء
    const actions = await db.userAction.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // آخر 20 تعليق
    const comments = await db.modComment.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, text: true, createdAt: true, mod: { select: { name: true, slug: true } } },
    })

    return ok({ user, actions, comments })
  } catch (err) {
    console.error('[admin/users/[id] GET] failed:', err)
    return internalError('Failed')
  }
}

// PUT /api/admin/users/[id] — تعديل مستخدم (دور، بيانات)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const target = await db.user.findUnique({ where: { id } })
    if (!target) {
      return notFound('User not found')
    }

    const newRole = body.role
    if (newRole) {
      if (id === currentUser.id && newRole !== currentUser.role) {
        return forbidden('لا يمكنك تغيير دورك الخاص')
      }
      if (target.role === 'owner' && currentUser.role !== 'owner') {
        return forbidden('Forbidden — only owners can modify other owners')
      }
      if (!canAssignRole(currentUser.role, newRole)) {
        return forbidden(`Forbidden — your role (${currentUser.role}) cannot assign role: ${newRole}`)
      }
    }

    const updateData: Record<string, unknown> = {}
    const allowed = ['username', 'email', 'avatarUrl', 'bio', 'role']
    for (const field of allowed) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    await db.user.update({ where: { id }, data: updateData })

    // لو تم تغيير الدور → إبطال الجلسات القديمة (tokenVersion)
    if (newRole && newRole !== target.role) {
      await invalidateUserSessions(id)
    }

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/users/[id] PUT] failed:', err)
    return internalError('Failed to update user')
  }
}

// DELETE /api/admin/users/[id] — حذف مستخدم
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params

    if (id === currentUser.id) {
      return forbidden('لا يمكنك حذف حسابك الخاص')
    }

    const target = await db.user.findUnique({ where: { id }, select: { role: true } })
    if (!target) {
      return notFound('User not found')
    }

    if (target.role === 'owner' && currentUser.role !== 'owner') {
      return forbidden('Forbidden — only owners can delete owners')
    }

    await db.user.delete({ where: { id } })
    return ok({ success: true })
  } catch (err) {
    console.error('[admin/users/[id] DELETE] failed:', err)
    return internalError('Failed to delete user')
  }
}
