import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { ok, notFound, unauthorized, internalError } from '@/lib/api-response'

export async function GET() {
  try {
    console.time('[settings-bootstrap]')

    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized()
    }

    const user = await db.user.findFirst({
      where: { id: neonUser.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
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

    if (!user) {
      return notFound()
    }

    const [notificationPreferences, settingsRows] = await Promise.all([
      db.notificationPreference.findUnique({
        where: { userId: user.id },
      }).then(async (pref) => {
        if (!pref) {
          return db.notificationPreference.create({
            data: {
              userId: user.id,
              emailEnabled: true,
              pushEnabled: true,
              dailySummary: true,
              summaryIntervalDays: 3,
              likeThreshold: 25,
              quietHoursEnabled: false,
              typePreferences: {},
            },
          })
        }
        return pref
      }),
      db.siteSetting.findMany(),
    ])

    const settings: Record<string, string> = {}

    for (const row of settingsRows) {
      settings[row.key] = row.value
    }

    console.timeEnd('[settings-bootstrap]')

    return ok(
      {
        profile: user,
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
    return internalError('Failed')
  }
}
