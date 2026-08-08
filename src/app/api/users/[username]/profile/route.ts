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
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

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
        instagramUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        githubUrl: true,
        discordUrl: true,
        accentColor: true,
        profileVisibility: true,
        hideJoinDate: true,
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

    const viewer = supabaseUser
      ? await db.user.findFirst({
          where: {
            OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
          },
          select: { id: true, username: true },
        })
      : null

    const isOwner = viewer?.id === user.id

    if (!isOwner && user.profileVisibility === 'nobody') {
      return NextResponse.json(
        {
          error: 'Profile is private',
          visibility: {
            canView: false,
            reason: 'private',
          },
        },
        { status: 403 }
      )
    }

    if (!isOwner && user.profileVisibility === 'followers') {
      if (!viewer) {
        return NextResponse.json(
          {
            error: 'Followers only',
            visibility: {
              canView: false,
              reason: 'followers_only',
            },
          },
          { status: 403 }
        )
      }

      const follow = await db.follow.findFirst({
        where: {
          followerId: viewer.id,
          followingId: user.id,
        },
        select: { id: true },
      })

      if (!follow) {
        return NextResponse.json(
          {
            error: 'Followers only',
            visibility: {
              canView: false,
              reason: 'followers_only',
            },
          },
          { status: 403 }
        )
      }
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
  } catch (err: any) {
    console.error('[profile GET] failed:', err?.message, err?.stack)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PUT /api/users/[username]/profile — تعديل الملف الشخصي
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const body = await req.json()
    const { username } = await params
    console.log('[API] Profile PUT - username:', username, 'body:', body)
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

    // فقط صاحب الملف يمكنه التعديل
    if (neonUser.username !== username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: Record<string, string | null | boolean> = {}

    // Handle username change separately
    if (body.username && body.username !== neonUser.username) {
      const existingUser = await db.user.findUnique({ where: { username: body.username } })
      if (existingUser) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
      }
      updateData.username = body.username
    }

    const allowedFields = ['bio', 'websiteUrl', 'twitterUrl', 'instagramUrl', 'tiktokUrl', 'youtubeUrl', 'githubUrl', 'discordUrl', 'accentColor', 'avatarUrl', 'bannerUrl', 'profileVisibility', 'hideJoinDate']
    const urlFields = ['websiteUrl', 'twitterUrl', 'instagramUrl', 'tiktokUrl', 'youtubeUrl', 'githubUrl', 'discordUrl']
    const booleanFields = ['hideJoinDate']
    const nullableFields = ['avatarUrl', 'bannerUrl']
    const allowedVisibility = ['everyone', 'followers', 'nobody']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'profileVisibility') {
          if (!allowedVisibility.includes(body[field])) {
            return NextResponse.json({ error: 'Invalid profile visibility' }, { status: 400 })
          }

          updateData[field] = body[field]
          continue
        }

        if (field === 'accentColor') {
          const value = String(body[field] || '').trim()

          if (value && !/^#([0-9A-F]{3}){1,2}$/i.test(value)) {
            return NextResponse.json({ error: 'Invalid accent color' }, { status: 400 })
          }

          updateData[field] = value || null
          continue
        }

        if (booleanFields.includes(field)) {
          updateData[field] = Boolean(body[field])
        } else if (nullableFields.includes(field)) {
          updateData[field] = body[field]
        } else {
          const value = body[field] || null
          if (urlFields.includes(field) && value) {
            updateData[field] = sanitizeUrl(value) || null
          } else {
            updateData[field] = value
          }
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
        instagramUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        githubUrl: true,
        discordUrl: true,
        accentColor: true,
        avatarUrl: true,
        bannerUrl: true,
        profileVisibility: true,
        hideJoinDate: true,
      },
    })

    return NextResponse.json({ profile: updatedUser })
  } catch (err: any) {
    console.error('[profile PUT] failed:', err?.message, err?.stack)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
