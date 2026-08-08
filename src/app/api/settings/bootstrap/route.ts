import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.time('[settings-bootstrap]')

    const supabase = await createClient()

    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const neonUser = await db.user.findFirst({
      where: {
        OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
      },
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

    if (!neonUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [notificationPreferences, settingsRows] = await Promise.all([
      db.notificationPreference.findUnique({
        where: { userId: neonUser.id },
      }),
      db.siteSetting.findMany(),
    ])

    const settings: Record<string, string> = {}

    for (const row of settingsRows) {
      settings[row.key] = row.value
    }

    console.timeEnd('[settings-bootstrap]')

    return NextResponse.json(
      {
        profile: neonUser,
        notifications: notificationPreferences,
        settings,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('[settings-bootstrap] failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
