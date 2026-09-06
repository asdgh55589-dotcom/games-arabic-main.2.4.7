import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/creator-dashboard/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getBanInfo, getSession } from '@/lib/auth'

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
    <SidebarProvider dir="rtl">
      <AppSidebar
        side="right"
        user={{
          name: session.username,
          email: session.email,
          avatar: session.avatarUrl ?? '',
        }}
      />
      <SidebarInset>
        <main className="flex-1 p-4 md:p-6 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
