import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ username: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    console.time('[full-profile total]')

    const { username } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(10, parseInt(searchParams.get('limit') || '10'))
    const supabase = await createClient()

    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()

    console.time('[full-profile user-query]')

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
        profileVisibility: true,
        hideJoinDate: true,
        role: true,
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.time('[full-profile viewer-query]')

    const viewerPromise = supabaseUser
      ? db.user.findFirst({
          where: {
            OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
          },
          select: { id: true },
        })
      : Promise.resolve(null)

    const modCount = user.mods.length
    const totalEndorsements = user.mods.reduce((s, m) => s + m.endorsements, 0)
    const totalDownloads = user.mods.reduce((s, m) => s + m.downloads, 0)
    const totalViews = 0

    console.time('[full-profile counts-query]')

    const countsPromise = Promise.all([
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
    ])

    const viewer = await viewerPromise

    console.timeEnd('[full-profile viewer-query]')

    console.time('[full-profile follow-query]')

    const followPromise = viewer
      ? db.follow.findFirst({
          where: {
            followerId: viewer.id,
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

    const response = NextResponse.json({
      profile: {
        ...user,
        onlineStatus,
        stats: {
          mods: user._count.mods,
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
    })

    console.timeEnd('[full-profile response]')
    console.timeEnd('[full-profile total]')

    return response
  } catch (error) {
    console.error('[full-profile GET] failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
