import type { Metadata } from 'next'
import { isCreatorRole } from '@/lib/roles'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SectionCard, StudioPageHeader } from '@/components/creator-dashboard/section-card'
import { NewsClient } from '@/components/creator/news-client'
import { getSession } from '@/lib/auth'
import { canPublishNews } from '@/lib/permissions'
import { getStudioDict, getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `${t.news.metaTitle} | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function CreatorNewsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/news')

  if (!isCreatorRole(session.role)) {
    redirect('/become-creator/apply')
  }
  const { dict } = await getStudioDict()

  // Track gate: news authoring is publisher-only (translators see a notice,
  // not a redirect — they belong in the studio).
  if (!canPublishNews(session.role)) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="text-4xl">📰</p>
        <h1 className="mt-4 text-2xl font-bold">{dict.news.trackOnlyTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {dict.news.trackOnlyDesc}
        </p>
        <Link
          href="/creator"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground"
        >
          {dict.news.trackOnlyCta}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <StudioPageHeader title={`📰 ${dict.news.title}`} subtitle={dict.news.subtitle} />
      <SectionCard title={dict.news.sectionTitle}>
        <NewsClient />
      </SectionCard>
    </div>
  )
}
