import { isCreatorRole } from '@/lib/roles'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SectionCard, StudioPageHeader } from '@/components/creator-dashboard/section-card'
import { StatsClient } from '@/components/creator/stats-client'
import { getSession } from '@/lib/auth'
import { getStudioDict, getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `${t.statsPage.metaTitle} | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function CreatorStatsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/stats')

  if (!isCreatorRole(session.role)) redirect('/become-creator/apply')

  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6">
      <StudioPageHeader title={`📊 ${dict.statsPage.title}`} subtitle={dict.statsPage.subtitle} />
      <SectionCard title={dict.statsPage.title} description={dict.statsPage.subtitle}>
        <StatsClient />
      </SectionCard>
    </div>
  )
}
