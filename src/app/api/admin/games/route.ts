import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

// GET /api/admin/games — قائمة الألعاب
export async function GET() {
  try {
    await requireModerator()
    const games = await db.game.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { mods: true } },
      },
    })
    return NextResponse.json({ games })
  } catch (err) {
    console.error('[admin/games GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// POST /api/admin/games — إنشاء لعبة جديدة
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    const required = ['name', 'tagline', 'description', 'platform', 'category', 'bannerUrl', 'thumbnailUrl']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `الحقل "${field}" مطلوب` }, { status: 400 })
      }
    }

    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

    return NextResponse.json({ game }, { status: 201 })
  } catch (err) {
    console.error('[admin/games POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed to create game' }, { status })
  }
}
