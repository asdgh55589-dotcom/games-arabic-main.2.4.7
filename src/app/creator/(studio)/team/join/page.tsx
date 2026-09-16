import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { InviteAcceptClient } from '@/components/creator/invite-accept-client'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'قبول دعوة الفريق',
  robots: { index: false, follow: false },
}

interface JoinPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function TeamJoinPage({ searchParams }: JoinPageProps) {
  const session = await getSession()
  const { token } = await searchParams
  if (!session) redirect(`/login?next=/creator/team/join${token ? `?token=${encodeURIComponent(token)}` : ''}`)

  if (!token) {
    redirect('/creator/team')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">دعوة الفريق</h1>
        <p className="text-sm text-muted-foreground mt-1">راجع تفاصيل الدعوة ثم اقبل أو ارفض</p>
      </div>
      <InviteAcceptClient token={token} />
    </div>
  )
}
