import type { Metadata } from 'next'
import { isCreatorRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { SectionCard, StudioPageHeader } from '@/components/creator-dashboard/section-card'
import { TeamManager } from '@/components/creator/team-manager'
import { getSession } from '@/lib/auth'
import { getStudioDict, getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `فريقي | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function CreatorTeamPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/team')

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }

  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6">
      <StudioPageHeader title={`👥 ${dict.nav.myTeam}`} subtitle="إدارة فريق التعريب الخاص بك" />
      <SectionCard title={dict.nav.myTeam} description="إدارة فريق التعريب الخاص بك">
        <TeamManager />
      </SectionCard>
    </div>
  )
}
