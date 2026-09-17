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
  searchParams: Promise<{ token?: string; transfer?: string }>
}

export default async function TeamJoinPage({ searchParams }: JoinPageProps) {
  const session = await getSession()
  const { token, transfer } = await searchParams
  const suffix = [token ? `token=${encodeURIComponent(token)}` : '', transfer ? 'transfer=1' : '']
    .filter(Boolean)
    .join('&')
  if (!session) redirect(`/login?next=/creator/team/join${suffix ? `?${suffix}` : ''}`)

  if (!token) {
    redirect('/creator/team')
  }

  const isTransfer = transfer === '1'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isTransfer ? 'نقل ملكية الفريق' : 'دعوة الفريق'}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground mt-1">
          {isTransfer ? 'راجع تفاصيل الترشيح ثم اقبل أو ارفض' : 'راجع تفاصيل الدعوة ثم اقبل أو ارفض'}
        </p>
      </div>
      <InviteAcceptClient token={token} mode={isTransfer ? 'transfer' : 'invite'} />
    </div>
  )
}
