import type { Metadata } from 'next'
import { isCreatorRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { SectionCard, StudioPageHeader } from '@/components/creator-dashboard/section-card'
import { ReportsClient } from '@/components/creator/reports-client'
import { getSession } from '@/lib/auth'
import { getStudioDict, getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `${t.reports.metaTitle} | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function CreatorReportsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/reports')

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }
  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6">
      <StudioPageHeader title={`🛡️ ${dict.reports.title}`} subtitle={dict.reports.subtitle} />
      <SectionCard title={dict.reports.title} description={dict.reports.subtitle}>
        <ReportsClient />
      </SectionCard>
    </div>
  )
}
