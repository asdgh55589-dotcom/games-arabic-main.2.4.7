import { Bell, Settings } from 'lucide-react'
import { isCreatorRole } from '@/lib/roles'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SectionCard, StudioPageHeader } from '@/components/creator-dashboard/section-card'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStudioDict, getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'
import { CreatorNotificationSettings } from '@/views/creator-notification-settings'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `${t.settingsPage.metaTitle} | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function CreatorSettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/settings')

  if (!isCreatorRole(session.role)) redirect('/become-creator/apply')

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { bio: true, websiteUrl: true, twitterUrl: true, youtubeUrl: true },
  })
  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6 max-w-2xl">
      <StudioPageHeader
        title={
          <span className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            {dict.settingsPage.title}
          </span>
        }
        subtitle={dict.settingsPage.subtitle}
      />

      <SectionCard title={dict.settingsPage.profile}>
        <div className="space-y-2 text-sm">
          <div>{dict.settingsPage.bio}: {user?.bio || dict.settingsPage.noBio}</div>
          <div dir="auto">{dict.settingsPage.website}: {user?.websiteUrl || '—'}</div>
          {/* Cross-surface link stays in a new tab so the studio page never unmounts. */}
          <Link href="/settings?section=profile" target="_blank" rel="noopener">
            <Button variant="outline" size="sm" className="mt-2">
              {dict.settingsPage.editProfile}
            </Button>
          </Link>
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {dict.settingsPage.notifications}
          </span>
        }
      >
        <CreatorNotificationSettings />
      </SectionCard>
    </div>
  )
}
