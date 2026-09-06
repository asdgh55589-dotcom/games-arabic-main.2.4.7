import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/creator-dashboard/app-sidebar'
import { StudioShell } from '@/components/creator-dashboard/studio-shell'
import { SidebarInset, SidebarProvider } from '@/components/official-ui/sidebar'
import { getBanInfo, getSession } from '@/lib/auth'
import { StudioLanguageProvider } from '@/lib/studio-i18n/context'

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  // Banned creators see the reason instead of a generic login redirect.
  // (getSession returns null for banned users, so check ban FIRST.)
  const ban = await getBanInfo()
  if (ban?.banned) redirect('/creator/suspended')

  const session = await getSession()

  if (!session) redirect('/login?next=/creator')

  const CREATOR_ONLY = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  if (!CREATOR_ONLY.includes(session.role)) {
    redirect('/become-creator/apply')
  }

  return (
    <StudioLanguageProvider>
      <StudioShell
        user={{
          name: session.username,
          email: session.email,
          avatar: session.avatarUrl ?? '',
        }}
      >
        {children}
      </StudioShell>
    </StudioLanguageProvider>
  )
}
