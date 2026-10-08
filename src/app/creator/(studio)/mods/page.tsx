import type { Metadata } from 'next'
import { isCreatorRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { SectionCard, StudioPageHeader } from '@/components/creator-dashboard/section-card'
import { ModsListClient } from '@/components/creator/mods-list-client'
import { getSession } from '@/lib/auth'
import { getStudioDict, getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `${t.modsPage.metaTitle} | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function MyModsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/mods')

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }

  const params = await searchParams
  const status = params?.status || 'all'
  const q = params?.q || ''
  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6">
      <StudioPageHeader title={`📦 ${dict.modsPage.title}`} />
      <SectionCard title={dict.modsPage.title}>
        <ModsListClient initialStatus={status} initialQuery={q} />
      </SectionCard>
    </div>
  )
}
