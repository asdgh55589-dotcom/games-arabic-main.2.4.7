import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
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

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{dict.nav.myTeam}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground mt-1">إدارة فريق التعريب الخاص بك</p>
      </div>
      <TeamManager />
    </div>
  )
}
