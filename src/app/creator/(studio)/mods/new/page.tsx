import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ModForm from '@/components/creator/mod-form'
import { getSession } from '@/lib/auth'
import { getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `${t.newModPage.metaTitle} | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function NewModPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/mods/new')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  return <ModForm />
}
