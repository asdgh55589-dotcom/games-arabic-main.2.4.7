import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ username: string }>
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) return null
  return db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true },
  })
}

// GET /api/users/[username]/follow — حالة المتابعة
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    const { username } = await params

    const targetUser = await db.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isFollowing = currentUser
      ? !!(await db.follow.findUnique({
          where: { followerId_followingId: { followerId: currentUser.id, followingId: targetUser.id } },
        }))
      : false

    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: targetUser.id } }),
      db.follow.count({ where: { followerId: targetUser.id } }),
    ])

    return NextResponse.json({ isFollowing, followersCount, followingCount })
  } catch (err) {
    console.error('[follow GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/users/[username]/follow — متابعة مستخدم
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params
    const targetUser = await db.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (currentUser.id === targetUser.id) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    const existing = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id, followingId: targetUser.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Already following' }, { status: 409 })
    }

    await db.follow.create({
      data: { followerId: currentUser.id, followingId: targetUser.id },
    })

    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: targetUser.id } }),
      db.follow.count({ where: { followerId: targetUser.id } }),
    ])

    return NextResponse.json({ isFollowing: true, followersCount, followingCount })
  } catch (err) {
    console.error('[follow POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE /api/users/[username]/follow — إلغاء المتابعة
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params
    const targetUser = await db.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await db.follow.deleteMany({
      where: { followerId: currentUser.id, followingId: targetUser.id },
    })

    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: targetUser.id } }),
      db.follow.count({ where: { followerId: targetUser.id } }),
    ])

    return NextResponse.json({ isFollowing: false, followersCount, followingCount })
  } catch (err) {
    console.error('[follow DELETE] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
