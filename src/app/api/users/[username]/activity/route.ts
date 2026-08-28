import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok, notFound, forbidden, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ username: string }>
}

// GET /api/users/[username]/activity — آخر النشاطات + إحصائيات شهرية
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const viewer = await getOptionalSession()
    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))

    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, profileVisibility: true },
    })
    if (!user) {
      return notFound()
    }

    const isOwner = viewer?.id === user.id

    if (!isOwner && user.profileVisibility !== 'everyone') {
      if (user.profileVisibility === 'nobody') {
        return forbidden('Private activity')
      }

      if (!viewer) {
        return forbidden('Followers only')
      }

      const follow = await db.follow.findFirst({
        where: {
          followerId: viewer.id,
          followingId: user.id,
        },
        select: { id: true },
      })

      if (!follow) {
        return forbidden('Followers only')
      }
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

    // إحصائيات شهرية (آخر 6 أشهر)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [monthlyComments, monthlyMods, monthlyEndorsements] = await Promise.all([
      db.modComment.findMany({
        where: { userId: user.id, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
      db.mod.findMany({
        where: { authorId: user.id, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
      db.endorsement.findMany({
        where: { userId: user.id, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
    ])

    // تجميع البيانات الشهرية
    const monthlyStatsMap: Record<string, { month: string; comments: number; mods: number; endorsements: number }> = {}

    // تهيئة الأشهر последние 6 أشهر
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyStatsMap[key] = { month: key, comments: 0, mods: 0, endorsements: 0 }
    }

    // حساب التعليقات الشهرية
    monthlyComments.forEach(c => {
      const d = new Date(c.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyStatsMap[key]) monthlyStatsMap[key].comments++
    })

    // حساب التعريبات الشهرية
    monthlyMods.forEach(m => {
      const d = new Date(m.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyStatsMap[key]) monthlyStatsMap[key].mods++
    })

    // حساب التأييدات الشهرية
    monthlyEndorsements.forEach(e => {
      const d = new Date(e.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyStatsMap[key]) monthlyStatsMap[key].endorsements++
    })

    const monthlyStats = Object.values(monthlyStatsMap).sort((a, b) => a.month.localeCompare(b.month))

    return ok({ comments, mods, modEdits, endorsements, monthlyStats }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } })
  } catch (err) {
    console.error('[activity GET] failed:', err)
    return internalError('Failed')
  }
}
