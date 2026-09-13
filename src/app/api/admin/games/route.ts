import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'

// GET /api/admin/games — قائمة الألعاب
export async function GET() {
  try {
    await requireModerator()
    const games = await db.game.findMany({
      take: 50,
      select: {
        id: true,
        name: true,
        slug: true,
        platform: true,
        thumbnailUrl: true,
        releaseYear: true,
        createdAt: true,
        _count: { select: { mods: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(games)
  } catch (err) {
    console.error('[admin/games GET] failed:', err)
    return internalError('Failed')
  }
}

// POST /api/admin/games — إنشاء لعبة جديدة
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    const required = [
      'name',
      'tagline',
      'description',
      'platform',
      'category',
      'bannerUrl',
      'thumbnailUrl',
    ]
    for (const field of required) {
      if (!body[field]) {
        return validationFail({ field, message: `الحقل "${field}" مطلوب` })
      }
    }

    let slug = body.slug || `${slugify(body.name)}-${(body.platform || '').toLowerCase()}`

    const existing = await db.game.findUnique({ where: { slug } })
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const game = await db.game.create({
      data: {
        slug,
        name: body.name,
        tagline: body.tagline,
        description: body.description,
        bannerUrl: body.bannerUrl,
        logoUrl: body.logoUrl || null,
        thumbnailUrl: body.thumbnailUrl,
        category: body.category,
        platform: body.platform,
        releaseYear: Number(body.releaseYear) || new Date().getFullYear(),
        featured: Boolean(body.featured),
      },
    })

    // إنشاء الأقسام الافتراضية لو موجودة
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      for (const catName of body.categories) {
        if (!catName) continue
        await db.category.create({
          data: {
            name: catName,
            slug: slugify(catName),
            gameId: game.id,
          },
        })
      }
    }

    // ISR: revalidate public pages after game creation
    try {
      revalidatePath('/')
      revalidatePath('/games/' + game.slug)
      revalidatePath('/platform/' + game.platform)
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort ISR revalidation

    return ok(game)
  } catch (err) {
    console.error('[admin/games POST] failed:', err)
    return internalError('Failed to create game')
  }
}
