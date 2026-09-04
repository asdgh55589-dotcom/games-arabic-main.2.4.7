import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ModsListClient } from '@/components/creator/mods-list-client'

export const metadata: Metadata = {
  title: 'تعريباتي | لوحة تحكم المُعَرِّب',
  robots: { index: false, follow: false },
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
    redirect('/become-creator')
  }

  const params = await searchParams
  const status = params?.status || 'all'
  const q = params?.q || ''

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📦 تعريباتي</h1>
      </div>

      <ModsListClient initialStatus={status} initialQuery={q} />
    </div>
  )
}
