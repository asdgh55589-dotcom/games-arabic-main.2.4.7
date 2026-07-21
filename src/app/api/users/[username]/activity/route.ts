import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ username: string }>
}

// GET /api/users/[username]/activity — آخر النشاطات
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))

    const user = await db.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // آخر التعليقات
    const comments = await db.modComment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        text: true,
        createdAt: true,
        mod: { select: { name: true, slug: true } },
      },
    })

    // آخر التعريبات
    const mods = await db.mod.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        thumbnailUrl: true,
        downloads: true,
        endorsements: true,
        createdAt: true,
      },
    })

    // آخر تعديلات التعريبات
    const modEdits = await db.mod.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        thumbnailUrl: true,
        updatedAt: true,
      },
    })

    // آخر التوصيات التي قدمها المستخدم
    const endorsements = await db.endorsement.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        value: true,
        createdAt: true,
        mod: { select: { name: true, slug: true, thumbnailUrl: true } },
      },
    })

    return NextResponse.json({ comments, mods, modEdits, endorsements })
  } catch (err) {
    console.error('[activity GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
