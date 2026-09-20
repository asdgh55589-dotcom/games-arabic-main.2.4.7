'use client'

import { usePathname } from 'next/navigation'
import { CookieConsent } from '@/components/cookie-consent'
import { ErrorBoundary } from '@/components/error-boundary'
import { Footer } from '@/components/footer'
import { Navbar } from '@/components/navbar'
import { ScrollToTop } from '@/components/scroll-to-top'
import { BookmarksProvider } from '@/contexts/bookmarks-context'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')
  // Creator studio renders its own standalone shell (official dashboard-01):
  // no site navbar/footer, like /admin.
  const isStandalone = isAdmin || pathname?.startsWith('/creator')
  if (isStandalone) {
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
        <Navbar />
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
