import { redirect } from 'next/navigation'
import { CreatorSidebar } from '@/components/creator/creator-sidebar'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) redirect('/login?next=/creator')

  const CREATOR_ONLY = ['creator', 'publisher']
  if (!CREATOR_ONLY.includes(session.role)) {
    redirect('/become-creator')
  }

  const fullUser = await db.user.findUnique({
    where: { id: session.id },
    select: { username: true, avatarUrl: true, role: true, tier: true, specialRoles: true },
  })

  const userForSidebar = {
    username: fullUser?.username || session.username,
    avatarUrl: fullUser?.avatarUrl || session.avatarUrl,
    role: fullUser?.role || session.role,
    tier: fullUser?.tier || 0,
    specialRoles: fullUser?.specialRoles || null,
  }

  return (
    <div className="flex min-h-screen" dir="rtl">
      <CreatorSidebar user={userForSidebar} />
      <main className="flex-1 p-6 md:p-8 bg-background">{children}</main>
    </div>
  )
}
