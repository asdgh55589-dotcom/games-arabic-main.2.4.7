import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canDelete } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/games/[id] — لعبة واحدة بكل بياناتها
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const game = await db.game.findUnique({
      where: { id },
      include: {
        categories: true,
        _count: { select: { mods: true } },
      },
    })
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    return NextResponse.json({ game })
  } catch (err) {
    console.error('[admin/games/[id] GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// PUT /api/admin/games/[id] — تعديل لعبة
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const existing = await db.game.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowed = ['name', 'tagline', 'description', 'bannerUrl', 'logoUrl', 'thumbnailUrl', 'category', 'platform', 'releaseYear', 'featured']
    for (const field of allowed) {
      if (body[field] !== undefined) {
        if (field === 'releaseYear') {
          updateData[field] = Number(body[field]) || existing.releaseYear
        } else if (field === 'featured') {
          updateData[field] = Boolean(body[field])
        } else {
          updateData[field] = body[field]
        }
      }
    }

    await db.$transaction(async (tx) => {
      await tx.game.update({ where: { id }, data: updateData })

      // تحديث الأقسام: امسح القديمة وأنشئ الجديدة
      if (Array.isArray(body.categories)) {
        await tx.category.deleteMany({ where: { gameId: id } })
        const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        for (const catName of body.categories) {
          if (!catName) continue
          await tx.category.create({
            data: { name: catName, slug: slugify(catName), gameId: id },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/games/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to update game' }, { status })
  }
}

// DELETE /api/admin/games/[id] — حذف لعبة
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params

    if (!canDelete(user)) {
      return NextResponse.json({ error: 'Forbidden — only admins can delete games' }, { status: 403 })
    }

    const existing = await db.game.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    await db.game.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/games/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to delete game' }, { status })
  }
}
