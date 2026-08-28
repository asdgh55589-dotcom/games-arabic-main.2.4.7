import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { updateModQualityScore } from '@/lib/quality-score'
import { logAction } from '@/lib/audit'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const ratings = await db.modRating.findMany({
      where: { modId: id },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mod = await db.mod.findUnique({
      where: { id },
      select: {
        qualityRating: true,
        qualityRatingsCount: true,
        qualityRatingsTotal: true,
      },
    })

    const average = mod?.qualityRatingsCount
      ? (mod.qualityRatingsTotal || 0) / mod.qualityRatingsCount
      : 0

    return NextResponse.json({
      ratings,
      stats: {
        average: Math.round(average * 10) / 10,
        count: mod?.qualityRatingsCount || 0,
        distribution: [1, 2, 3, 4, 5].map((star) => ({
          star,
          count: ratings.filter((r) => r.rating === star).length,
        })),
      },
    })
  } catch (error) {
    console.error('[ratings GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await request.json()
    const { userId, rating, comment } = body

    if (!userId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'بيانات غير صحيحة' },
        { status: 400 }
      )
    }

    // Upsert rating
    const existingRating = await db.modRating.findUnique({
      where: { modId_userId: { modId: id, userId } },
    })

    if (existingRating) {
      await db.modRating.update({
        where: { id: existingRating.id },
        data: { rating, comment: comment || existingRating.comment },
      })
    } else {
      await db.modRating.create({
        data: {
          modId: id,
          userId,
          rating,
          comment,
        },
      })
    }

    // Recalculate mod aggregates
    const allRatings = await db.modRating.findMany({
      where: { modId: id },
      select: { rating: true },
    })

    const total = allRatings.reduce((sum, r) => sum + r.rating, 0)
    const count = allRatings.length
    const average = count > 0 ? total / count : 0

    await db.mod.update({
      where: { id },
      data: {
        qualityRatingsCount: count,
        qualityRatingsTotal: total,
        qualityRating: Math.round(average * 10) / 10,
        rating: Math.round(average * 10) / 10,
        ratingCount: count,
      },
    })

    // Update quality score
    await updateModQualityScore(id)

    await logAction({
      action: existingRating ? 'update_rating' : 'create_rating',
      entity: 'mod',
      entityId: id,
      details: JSON.stringify({ rating, comment }),
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ratings POST]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const existing = await db.modRating.findUnique({
      where: { modId_userId: { modId: id, userId } },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'التقييم غير موجود' },
        { status: 404 }
      )
    }

    await db.modRating.delete({ where: { id: existing.id } })

    // Recalculate mod aggregates
    const allRatings = await db.modRating.findMany({
      where: { modId: id },
      select: { rating: true },
    })

    const total = allRatings.reduce((sum, r) => sum + r.rating, 0)
    const count = allRatings.length
    const average = count > 0 ? total / count : 0

    await db.mod.update({
      where: { id },
      data: {
        qualityRatingsCount: count,
        qualityRatingsTotal: total,
        qualityRating: Math.round(average * 10) / 10,
        rating: Math.round(average * 10) / 10,
        ratingCount: count,
      },
    })

    await updateModQualityScore(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ratings DELETE]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
