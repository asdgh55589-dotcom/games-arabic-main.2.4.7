import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
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

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  const params = await searchParams
  const status = params?.status || 'all'
  const q = params?.q || ''
  const { dict } = await getStudioDict()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📦 {dict.modsPage.title}</h1>
      </div>

      <ModsListClient initialStatus={status} initialQuery={q} />
    </div>
  )
}
