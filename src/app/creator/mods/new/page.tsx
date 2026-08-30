import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import ModForm from '@/components/creator/mod-form'

export const metadata: Metadata = {
  title: 'تعريب جديد | لوحة تحكم المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function NewModPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/mods/new')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator')
  }

  return <ModForm />
}
