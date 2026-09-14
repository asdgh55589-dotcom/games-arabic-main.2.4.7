import { BarChart3 } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
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

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) redirect('/become-creator/apply')

  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          {dict.statsPage.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{dict.statsPage.subtitle}</p>
      </div>
      <StatsClient />
    </div>
  )
}
