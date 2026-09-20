import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Swiss Preview',
  robots: { index: false, follow: false },
}

/**
 * Preview layout — intentionally pass-through.
 * The root layout (AppShell/Navbar/Footer + ThemeProvider) still wraps
 * this route; the preview scopes its own theme via `.swiss-scope` so
 * no global styles are affected. Kept as a file so a future merge can
 * opt out of AppShell here without touching the root layout.
 */
export default function SwissPreviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
