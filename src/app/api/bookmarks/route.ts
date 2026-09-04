import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import {
  ok,
  unauthorized,
  notFound,
  conflict,
  validationFail,
  internalError,
} from '@/lib/api-response'
import { BookmarkSchema } from '@/lib/schemas'

// POST /api/bookmarks — حفظ تعريب في المفضلة
export async function POST(req: NextRequest) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized()
    }

    const body = await req.json()
    const parsed = BookmarkSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { modId } = parsed.data

    const mod = await db.mod.findUnique({ where: { id: modId }, select: { id: true } })
    if (!mod) {
      return notFound('Mod not found')
    }

    const existing = await db.bookmark.findUnique({
      where: { userId_modId: { userId: user.id, modId } },
    })
    if (existing) {
      return conflict('Already bookmarked')
    }

    await db.bookmark.create({
      data: { userId: user.id, modId },
    })

    return ok({ bookmarked: true })
  } catch (err) {
    console.error('[bookmarks POST] failed:', err)
    return internalError('Failed to add bookmark')
  }
}

// GET /api/bookmarks — جلب جميع مفضلات المستخدم
export async function GET() {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized()
    }

    const bookmarks = await db.bookmark.findMany({
      where: { userId: user.id },
      include: {
        mod: {
          select: {
            id: true,
            slug: true,
            name: true,
            summary: true,
            thumbnailUrl: true,
            imageUrl: true,
            downloads: true,
            endorsements: true,
            views: true,
            rating: true,
            ratingCount: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            game: {
              select: {
                name: true,
                slug: true,
                platform: true,
              },
            },
            category: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const data = bookmarks.map((b) => ({
      ...b.mod,
      galleryUrls: '',
      version: '',
      fileSize: '',
      fileFormat: '',
      tags: '',
      series: '',
      translationTeam: '',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      isLatest: false,
      releaseDate: b.createdAt,
      comments: 0,
    }))

    return ok(data)
  } catch (err) {
    console.error('[bookmarks GET] failed:', err)
    return internalError('Failed to fetch bookmarks')
  }
}

// DELETE /api/bookmarks — إلغاء الحفظ
export async function DELETE(req: NextRequest) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized()
    }

    const { searchParams } = new URL(req.url)
    const modId = searchParams.get('modId')
    if (!modId) {
      return validationFail({ modId: 'Required' })
    }

    await db.bookmark.deleteMany({
      where: { userId: user.id, modId },
    })

    return ok({ bookmarked: false })
  } catch (err) {
    console.error('[bookmarks DELETE] failed:', err)
    return internalError('Failed to remove bookmark')
  }
}
