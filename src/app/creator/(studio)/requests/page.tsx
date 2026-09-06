import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RequestsManager } from '@/components/creator/requests-manager'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'طلبات التعريب | لوحة تحكم المُعَرِّب',
  robots: { index: false, follow: false },
}

export default async function CreatorRequestsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator/requests')

  const creatorRoles = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">📥 طلبات التعريب</h1>
        <p className="text-sm text-muted-foreground mt-1">
          تصفح طلبات المجتمع وقبول ما يناسبك، ثم اربطه بتعريبك عند الإكمال
        </p>
      </div>
      <RequestsManager />
    </div>
  )
}
