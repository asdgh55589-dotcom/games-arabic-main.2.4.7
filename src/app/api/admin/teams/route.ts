import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { slugify } from '@/lib/utils'

// GET /api/admin/teams — قائمة الفرق
export async function GET() {
  try {
    await requireModerator()
    const teams = await db.team.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      include: {
        _count: { select: { mods: true, memberships: true } },
      },
    })
    return NextResponse.json({ teams })
  } catch (err) {
    console.error('[admin/teams GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// POST /api/admin/teams — إنشاء فريق جديد
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
    }

    const slug = slugify(body.name)
    const existing = await db.team.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: 'فريق بنفس الاسم موجود بالفعل' }, { status: 400 })
    }

    const team = await db.team.create({
      data: {
        slug,
        name: body.name.trim(),
        description: body.description || '',
        logoUrl: body.logoUrl || '',
        bannerUrl: body.bannerUrl || '',
        websiteUrl: body.websiteUrl || '',
        discordUrl: body.discordUrl || '',
        isOfficial: body.isOfficial || false,
        isFeatured: body.isFeatured || false,
        order: body.order || 0,
      },
    })

    return NextResponse.json({ team }, { status: 201 })
  } catch (err) {
    console.error('[admin/teams POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
