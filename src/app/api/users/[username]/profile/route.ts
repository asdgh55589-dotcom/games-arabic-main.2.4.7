import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { sanitizeUrl } from '@/lib/sanitize'

interface RouteParams {
  params: Promise<{ username: string }>
}

// GET /api/users/[username]/profile — بيانات الملف الشخصي
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params

    const user = await db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        websiteUrl: true,
        twitterUrl: true,
        githubUrl: true,
        discordUrl: true,
        accentColor: true,
        role: true,
        joinedAt: true,
        lastLoginAt: true,
        tier: true,
        specialRoles: true,
        qualityScore: true,
        _count: {
          select: {
            mods: true,
            comments: true,
            endorsements: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // حساب الإحصائيات
    const mods = await db.mod.findMany({
      where: { authorId: user.id },
      select: { downloads: true, endorsements: true, views: true },
    })

    const totalDownloads = mods.reduce((s, m) => s + m.downloads, 0)
    const totalEndorsements = mods.reduce((s, m) => s + m.endorsements, 0)
    const totalViews = mods.reduce((s, m) => s + m.views, 0)

    // هل المستخدم معرب؟
    const isTranslator = ['owner', 'admin', 'moderator'].includes(user.role)

    // تاريخ أول تعريب
    let firstModDate: string | null = null
    if (isTranslator) {
      const firstMod = await db.mod.findFirst({
        where: { authorId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
      firstModDate = firstMod?.createdAt.toISOString() || null
    }

    // عدد المتابعين والمتابَعين
    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
    ])

    // حالة الاتصال
    const now = new Date()
    const onlineStatus =
      user.lastLoginAt && now.getTime() - user.lastLoginAt.getTime() < 5 * 60 * 1000
        ? 'online'
        : 'offline'

    // نظام XP
    const xpPoints = totalDownloads + totalEndorsements
    const xpLevels = [
      { name: 'مبتدئ', nameEn: 'Beginner', max: 100 },
      { name: 'متعلم', nameEn: 'Learner', max: 300 },
      { name: 'ماهر', nameEn: 'Skilled', max: 600 },
      { name: 'محترف', nameEn: 'Professional', max: 1000 },
      { name: 'خبير', nameEn: 'Expert', max: Infinity },
    ]
    const levelIndex = xpLevels.findIndex((l) => xpPoints <= l.max)
    const xpLevel = {
      level: levelIndex + 1,
      name: xpLevels[levelIndex].name,
      nameEn: xpLevels[levelIndex].nameEn,
      points: xpPoints,
    }
    const prevMax = levelIndex > 0 ? xpLevels[levelIndex - 1].max : 0
    const currMax = xpLevels[levelIndex].max
    const xpProgress =
      currMax === Infinity
        ? 100
        : Math.round(((xpPoints - prevMax) / (currMax - prevMax)) * 100)

    return NextResponse.json({
      profile: {
        ...user,
        stats: {
          mods: user._count.mods,
          totalDownloads,
          totalEndorsements,
          totalViews,
          followersCount,
          followingCount,
        },
        onlineStatus,
        xp: { ...xpLevel, progress: xpProgress },
        isTranslator,
        firstModDate,
        rating: user.qualityScore,
      },
    })
  } catch (err) {
    console.error('[profile GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PUT /api/users/[username]/profile — تعديل الملف الشخصي
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true, username: true },
    })
    if (!neonUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { username } = await params

    // فقط صاحب الملف يمكنه التعديل
    if (neonUser.username !== username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const updateData: Record<string, string | null> = {}

    const allowedFields = ['bio', 'websiteUrl', 'twitterUrl', 'githubUrl', 'discordUrl', 'accentColor']
    const urlFields = ['websiteUrl', 'twitterUrl', 'githubUrl', 'discordUrl']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const value = body[field] || null
        if (urlFields.includes(field) && value) {
          updateData[field] = sanitizeUrl(value) || null
        } else {
          updateData[field] = value
        }
      }
    }

    const updatedUser = await db.user.update({
      where: { id: neonUser.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        bio: true,
        websiteUrl: true,
        twitterUrl: true,
        githubUrl: true,
        discordUrl: true,
        accentColor: true,
      },
    })

    return NextResponse.json({ profile: updatedUser })
  } catch (err) {
    console.error('[profile PUT] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
