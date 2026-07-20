import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

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

    return NextResponse.json({
      profile: {
        ...user,
        stats: {
          mods: user._count.mods,
          totalDownloads,
          totalEndorsements,
          totalViews,
        },
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
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null
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
