import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

// GET /api/admin/teams/[id] — تفاصيل الفريق
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const team = await db.team.findUnique({
      where: { id },
      include: {
        memberships: { orderBy: { joinedAt: 'desc' } },
        contactLinks: { orderBy: { order: 'asc' } },
        mods: {
          select: { id: true, name: true, slug: true, downloads: true, endorsements: true, thumbnailUrl: true },
          orderBy: { downloads: 'desc' },
        },
        _count: { select: { mods: true, memberships: true } },
      },
    })

    if (!team) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    return NextResponse.json({ team })
  } catch (err) {
    console.error('[admin/teams/[id] GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// PUT /api/admin/teams/[id] — تعديل الفريق
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const existing = await db.team.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) { data.name = body.name.trim(); data.slug = slugify(body.name) }
    if (body.description !== undefined) data.description = body.description
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl
    if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl
    if (body.websiteUrl !== undefined) data.websiteUrl = body.websiteUrl
    if (body.discordUrl !== undefined) data.discordUrl = body.discordUrl
    if (body.isOfficial !== undefined) data.isOfficial = body.isOfficial
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
    if (body.order !== undefined) data.order = body.order

    const team = await db.team.update({ where: { id }, data })
    return NextResponse.json({ team })
  } catch (err) {
    console.error('[admin/teams/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// DELETE /api/admin/teams/[id] — حذف الفريق
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params

    const existing = await db.team.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    // إلغاء الربط من التعريبات
    await db.mod.updateMany({ where: { teamId: id }, data: { teamId: null } })
    await db.team.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/teams/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
