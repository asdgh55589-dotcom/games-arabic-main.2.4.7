import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { parsePagination } from '@/lib/api-utils'

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
          email: true,
          avatarUrl: true,
          bio: true,
          role: true,
          provider: true,
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

    return NextResponse.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin/users GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// POST /api/admin/users — إنشاء مستخدم جديد (admin/owner)
// ملاحظة: المستخدمون يسجلون عبر OAuth فقط. هذا الـ route للإنشاء اليدوي من الإدارة.
export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAdmin()
    const body = await req.json()

    if (!body.username || !body.email) {
      return NextResponse.json({ error: 'username, email مطلوبة' }, { status: 400 })
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ username: body.username }, { email: body.email }] },
    })
    if (existing) {
      return NextResponse.json({ error: 'اسم المستخدم أو البريد مستخدم بالفعل' }, { status: 400 })
    }

    const role = body.role || 'member'
    if ((role === 'admin' || role === 'owner') && currentUser.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden — only owners can create admin/owner accounts' },
        { status: 403 }
      )
    }

    const user = await db.user.create({
      data: {
        username: body.username,
        email: body.email,
        avatarUrl: body.avatarUrl || null,
        bio: body.bio || null,
        role,
        provider: 'admin',
      },
      select: { id: true, username: true, email: true, role: true, avatarUrl: true, provider: true },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    console.error('[admin/users POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to create user' }, { status })
  }
}
