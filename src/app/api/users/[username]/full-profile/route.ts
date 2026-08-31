import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok, notFound, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ username: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    console.time('[full-profile total]')

    const { username } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(10, parseInt(searchParams.get('limit') || '10'))

    const viewer = await getOptionalSession()

    console.time('[full-profile user-query]')

    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
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
        tier: true,
        qualityScore: true,
        specialRoles: true,
        joinedAt: true,
        lastLoginAt: true,
        mods: {
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnailUrl: true,
            downloads: true,
            endorsements: true,
            createdAt: true,
          },
        },
        comments: {
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            text: true,
            createdAt: true,
            mod: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            mods: true,
            comments: true,
            endorsements: true,
          },
        },
      },
    })

    console.timeEnd('[full-profile user-query]')

    if (!user) {
      return notFound()
    }

    console.time('[full-profile viewer-query]')

    const viewerPromise = Promise.resolve(viewer ? { id: viewer.id } : null)

    // FIX: Use aggregate for accurate stats (not capped at 10) — Critical #1, #2
    const agg = await db.mod.aggregate({
      where: { authorId: user.id },
      _sum: { endorsements: true, downloads: true, views: true },
      _count: true,
    })
    const modCount = agg._count
    const totalEndorsements = agg._sum.endorsements || 0
    const totalDownloads = agg._sum.downloads || 0
    const totalViews = agg._sum.views || 0

    // XP calculation (like profile/route.ts) — Critical #3
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
    const xpProgress = currMax === Infinity ? 100 : Math.round(((xpPoints - prevMax) / (currMax - prevMax)) * 100)
    const xp = { ...xpLevel, progress: xpProgress }

    console.time('[full-profile counts-query]')

    const countsPromise = Promise.all([
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
    ])

    const resolvedViewer = await viewerPromise

    console.timeEnd('[full-profile viewer-query]')

    console.time('[full-profile follow-query]')

    const followPromise = resolvedViewer
      ? db.follow.findFirst({
          where: {
            followerId: resolvedViewer.id,
            followingId: user.id,
          },
          select: { id: true },
        })
      : Promise.resolve(null)

    const [[followersCount, followingCount], follow] = await Promise.all([
      countsPromise,
      followPromise,
    ])

    const isFollowing = Boolean(follow)

    console.timeEnd('[full-profile counts-query]')
    console.timeEnd('[full-profile follow-query]')

    const now = new Date()

    const onlineStatus =
      user.lastLoginAt && now.getTime() - user.lastLoginAt.getTime() < 5 * 60 * 1000
        ? 'online'
        : 'offline'

    const badges = [
      {
        id: 'first_mod',
        name: 'مترجم مبتدئ',
        description: 'نشر أول تعريب',
        icon: '🌱',
        earned: modCount >= 1,
      },
      {
        id: 'active_translator',
        name: 'مترجم نشط',
        description: 'نشر 5 تعريبات',
        icon: '⭐',
        earned: modCount >= 5,
      },
      {
        id: 'pro_translator',
        name: 'مترجم محترف',
        description: 'نشر 10 تعريبات',
        icon: '🏆',
        earned: modCount >= 10,
      },
      {
        id: 'endorsement_star',
        name: 'شهادة التميز',
        description: 'حصل على 100 تأييد',
        icon: '🏅',
        earned: totalEndorsements >= 100,
      },
      {
        id: 'top_downloads',
        name: 'الأكثر تحميلاً',
        description: 'حصل على 1000+ تحميل',
        icon: '🚀',
        earned: totalDownloads >= 1000,
      },
    ]

    console.time('[full-profile response]')

    const response = ok(
      {
        profile: {
          ...user,
          onlineStatus,
          xp,
          stats: {
            mods: agg._count,
            totalDownloads,
            totalEndorsements,
            totalViews,
            followersCount,
            followingCount,
          },
        },
        activity: {
          comments: user.comments,
          mods: user.mods,
        },
        badges,
        follow: {
          isFollowing,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=60',
        },
      }
    )

    console.timeEnd('[full-profile response]')
    console.timeEnd('[full-profile total]')

    return response
  } catch (error) {
    console.error('[full-profile GET] failed:', error)
    return internalError('Failed')
  }
}
