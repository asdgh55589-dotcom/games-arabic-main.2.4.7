import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword, updateSupabaseAuthPassword, deleteSupabaseAuthUser, invalidateUserSessions } from '@/lib/auth'
import { logUserAction } from '@/lib/audit'

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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

    return NextResponse.json({ user, actions, comments })
  } catch (err) {
    console.error('[admin/users/[id] GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// PUT /api/admin/users/[id] — تعديل مستخدم (دور، بيانات، كلمة مرور)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const target = await db.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const newRole = body.role
    if (newRole) {
      if (id === currentUser.id && newRole !== currentUser.role) {
        return NextResponse.json({ error: 'لا يمكنك تغيير دورك الخاص' }, { status: 403 })
      }
      if (newRole === 'owner' && currentUser.role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden — only owners can assign owner role' }, { status: 403 })
      }
      if (target.role === 'owner' && currentUser.role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden — only owners can modify other owners' }, { status: 403 })
      }
    }

    const updateData: Record<string, unknown> = {}
    const allowed = ['username', 'email', 'avatarUrl', 'bio', 'role']
    for (const field of allowed) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    if (body.password) {
      updateData.password = await hashPassword(body.password)
      // تحديث كلمة المرور في Supabase Auth كمان
      if (target.supabaseId) {
        const ok = await updateSupabaseAuthPassword(target.supabaseId, body.password)
        if (!ok) {
          console.warn('[admin/users PUT] failed to update Supabase Auth password for', target.id)
        }
      }
    }

    await db.user.update({ where: { id }, data: updateData })

    // لو تم تغيير الدور → إبطال الجلسات القديمة (tokenVersion)
    if (newRole && newRole !== target.role) {
      await invalidateUserSessions(id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to update user' }, { status })
  }
}

// DELETE /api/admin/users/[id] — حذف مستخدم
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params

    if (id === currentUser.id) {
      return NextResponse.json({ error: 'لا يمكنك حذف حسابك الخاص' }, { status: 403 })
    }

    const target = await db.user.findUnique({ where: { id }, select: { role: true, supabaseId: true } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (target.role === 'owner' && currentUser.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden — only owners can delete owners' }, { status: 403 })
    }

    // حذف المستخدم من Supabase Auth كمان
    if (target.supabaseId) {
      const ok = await deleteSupabaseAuthUser(target.supabaseId)
      if (!ok) {
        console.warn('[admin/users DELETE] failed to delete Supabase Auth user for', id)
      }
    }

    await db.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to delete user' }, { status })
  }
}
