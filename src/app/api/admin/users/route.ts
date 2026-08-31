import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, type UserRole } from '@/lib/auth'
import { parsePagination } from '@/lib/api-utils'
import { ok, okPaginated, forbidden, internalError, validationFail } from '@/lib/api-response'

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

// GET /api/admin/users — قائمة المستخدمين مع pagination + فلتر
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const { page, limit } = parsePagination(
      searchParams.get('page'),
      searchParams.get('limit'),
      { limit: 50, maxLimit: 100 }
    )
    const search = searchParams.get('search')?.trim() || null
    const role = searchParams.get('role') || null
    const banned = searchParams.get('banned') || null

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { displayName: { contains: search } },
        { email: { contains: search } },
      ]
    }
    if (role) where.role = role
    if (banned === 'banned') where.bannedUntil = { not: null, gt: new Date() }
    if (banned === 'active') where.OR = [{ bannedUntil: null }, { bannedUntil: { lte: new Date() } }]

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
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
          joinedAt: true,
          _count: { select: { mods: true, comments: true, endorsements: true } },
        },
      }),
    ])

    return okPaginated(users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin/users GET] failed:', err)
    return internalError('Failed')
  }
}

// POST /api/admin/users — إنشاء مستخدم جديد (admin/owner)
// ملاحظة: المستخدمون يسجلون عبر OAuth فقط. هذا الـ route للإنشاء اليدوي من الإدارة.
export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAdmin()
    const body = await req.json()

    if (!body.email) {
      return validationFail({ message: 'البريد مطلوب' })
    }

    // استخدام username المُعطى أو توليده من البريد
    let username = body.username
    if (!username) {
      const { generateUsernameFromEmail } = await import('@/lib/username-generator')
      username = await generateUsernameFromEmail(body.email)
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ username }, { email: body.email }] },
    })
    if (existing) {
      return validationFail({ message: 'اسم المستخدم أو البريد مستخدم بالفعل' })
    }

    const role = body.role || 'member'
    if (!canAssignRole(currentUser.role, role)) {
      return forbidden(`Forbidden — your role (${currentUser.role}) cannot assign role: ${role}`)
    }

    const user = await db.user.create({
      data: {
        username,
        displayName: body.displayName || null,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        email: body.email,
        avatarUrl: body.avatarUrl || null,
        bio: body.bio || null,
        role,
      },
      select: { id: true, username: true, displayName: true, email: true, role: true, avatarUrl: true },
    })

    return ok(user)
  } catch (err) {
    console.error('[admin/users POST] failed:', err)
    return internalError('Failed to create user')
  }
}
