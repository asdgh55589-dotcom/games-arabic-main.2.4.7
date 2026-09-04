'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ErrorBoundary } from '@/components/error-boundary'
import { ScrollToTop } from '@/components/scroll-to-top'
import { BookmarksProvider } from '@/contexts/bookmarks-context'
import { CookieConsent } from '@/components/cookie-consent'
import { useAuth } from '@/contexts/auth-context'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')
  if (isAdmin) {
    return (
      <BookmarksProvider>
        <ErrorBoundary label="this page">{children}</ErrorBoundary>
        <CookieConsent />
        <ScrollToTop />
      </BookmarksProvider>
    )
  }
  return (
    <BookmarksProvider>
      <div className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          تخطي إلى المحتوى الرئيسي
        </a>
        <Navbar key={user?.username} />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <ErrorBoundary label="this page">{children}</ErrorBoundary>
        </main>
        <Footer />
        <CookieConsent />
        <ScrollToTop />
      </div>
    </BookmarksProvider>
  )
}
