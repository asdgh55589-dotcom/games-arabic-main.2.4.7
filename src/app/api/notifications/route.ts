import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) return null
  const neonUser = await db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true },
  })
  return neonUser
}

// GET /api/notifications — قائمة الإشعارات
export async function GET(req: NextRequest) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const type = searchParams.get('type')
    const read = searchParams.get('read')

    const where: Record<string, unknown> = { userId: neonUser.id }
    if (type && type !== 'all') where.type = type
    if (read === 'true') where.readAt = { not: null }
    if (read === 'false') where.readAt = null

    const [total, notifications] = await Promise.all([
      db.notification.count({ where }),
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          data: true,
          readAt: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    })
  } catch (err) {
    console.error('[notifications GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/notifications — إنشاء إشعار جديد
export async function POST(req: NextRequest) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, title, message, data } = body

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, message' },
        { status: 400 },
      )
    }

    const notification = await db.notification.create({
      data: {
        userId: neonUser.id,
        type,
        title,
        message,
        data: data ?? undefined,
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (err) {
    console.error('[notifications POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
