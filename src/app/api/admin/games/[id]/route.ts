import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canDelete } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { ok, forbidden, notFound, internalError } from '@/lib/api-response'
import { revalidatePath } from 'next/cache'

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
      return notFound('Game not found')
    }
    return ok(game)
  } catch (err) {
    console.error('[admin/games/[id] GET] failed:', err)
    return internalError('Failed')
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
      return notFound('Game not found')
    }

    const updateData: Record<string, unknown> = {}
    const allowed = [
      'name',
      'tagline',
      'description',
      'bannerUrl',
      'logoUrl',
      'thumbnailUrl',
      'category',
      'platform',
      'releaseYear',
      'featured',
    ]
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
        for (const catName of body.categories) {
          if (!catName) continue
          await tx.category.create({
            data: { name: catName, slug: slugify(catName), gameId: id },
          })
        }
      }
    })

    // ISR: revalidate public pages after game update
    try {
      const gameSlug = updateData.slug || existing.slug
      const gamePlatform = updateData.platform || existing.platform
      revalidatePath('/')
      revalidatePath('/games/' + gameSlug)
      revalidatePath('/platform/' + gamePlatform)
    } catch {}

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/games/[id] PUT] failed:', err)
    return internalError('Failed to update game')
  }
}

// DELETE /api/admin/games/[id] — حذف لعبة
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    const { id } = await params

    if (!canDelete(user)) {
      return forbidden('Forbidden — only admins can delete games')
    }

    const existing = await db.game.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return notFound('Game not found')
    }

    await db.game.delete({ where: { id } })
    return ok({ success: true })
  } catch (err) {
    console.error('[admin/games/[id] DELETE] failed:', err)
    return internalError('Failed to delete game')
  }
}
