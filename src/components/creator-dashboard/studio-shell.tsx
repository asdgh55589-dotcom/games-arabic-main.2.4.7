'use client'

import { AppSidebar } from '@/components/creator-dashboard/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SiteHeader } from '@/components/creator-dashboard/site-header'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

/**
 * Client shell for the creator studio. Owns dir/lang/side so AR/EN flips
 * 100%: RTL docks the sidebar right, LTR docks it left (official preview).
 */
export function StudioShell({
  user,
  children,
}: {
  user: { name: string; email: string; avatar: string; role?: string }
  children: React.ReactNode
}) {
  const { dir, locale } = useStudioLanguage()

  return (
    <SidebarProvider
      dir={dir}
      lang={locale}
      className="creator-studio-official"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        تخطي إلى المحتوى الرئيسي
      </a>
      <AppSidebar
        side={dir === 'rtl' ? 'right' : 'left'}
        user={user}
      />
      <SidebarInset>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6 bg-background outline-none">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
