import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ModForm from '@/components/creator/mod-form'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStudioLocale } from '@/lib/studio-i18n/server'
import { ar } from '@/lib/studio-i18n/ar'
import { en } from '@/lib/studio-i18n/en'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getStudioLocale()
  const t = locale === 'en' ? en : ar
  return {
    title: `${t.editModPage.metaTitle} | ${t.meta.suffix}`,
    robots: { index: false, follow: false },
  }
}

export default async function EditModPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/login?next=/creator/mods/${id}/edit`)

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  const mod = await db.mod.findUnique({ where: { id } })
  if (!mod) notFound()

  const isAdmin = ['admin', 'manager', 'owner'].includes(session.role)
  if (mod.authorId !== session.id && !isAdmin) {
    redirect('/creator/mods')
  }

  return <ModForm modId={id} />
}
