import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import ModForm from '@/components/creator/mod-form'

export const metadata: Metadata = {
  title: 'تعديل التعريب | لوحة تحكم المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function EditModPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/login?next=/creator/mods/${id}/edit`)

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator')
  }

  const mod = await db.mod.findUnique({ where: { id } })
  if (!mod) notFound()

  const isAdmin = ['admin', 'manager', 'owner'].includes(session.role)
  if (mod.authorId !== session.id && !isAdmin) {
    redirect('/creator/mods')
  }

  return <ModForm modId={id} />
}
