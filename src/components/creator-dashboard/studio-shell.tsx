'use client'

import { AppSidebar } from '@/components/creator-dashboard/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/official-ui/sidebar'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

/**
 * Client shell for the creator studio. Owns dir/lang/side so AR/EN flips
 * 100%: RTL docks the sidebar right, LTR docks it left (official preview).
 */
export function StudioShell({
  user,
  children,
}: {
  user: { name: string; email: string; avatar: string }
  children: React.ReactNode
}) {
  const { dir, locale } = useStudioLanguage()

  return (
    <SidebarProvider
      dir={dir}
      lang={locale}
      className="creator-studio-official"
    >
      <AppSidebar
        side={dir === 'rtl' ? 'right' : 'left'}
        user={user}
      />
      <SidebarInset>
        <main className="flex-1 p-4 md:p-6 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
