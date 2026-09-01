import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { cairo } from "./fonts";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";
import { SeoUpdater } from "@/components/seo-updater";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/contexts/auth-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { organizationJsonLd } from "@/lib/seo/structured-data";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://games-arabic.com'),
  title: {
    default: 'Games Arabic',
    template: '%s | Games Arabic',
  },
  description: 'أكبر منصة عربية لتعريب الألعاب',
  keywords: ['تعريب', 'ألعاب', 'arabic', 'games', 'PC', 'NS', 'PS4', 'PS3', 'PS2', 'PS1', 'ترجمة', 'تعريب ألعاب', 'Games Arabic'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.png',
  },
  openGraph: {
    title: 'GAMES ARABIC — تعريب الألعاب',
    description: 'منصة تعريب وأرشفة الألعاب العربية — حمّل أحدث التعريبات لألعابك المفضلة',
    siteName: 'GAMES ARABIC',
    locale: 'ar_SA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GAMES ARABIC — تعريب الألعاب',
    description: 'منصة تعريب وأرشفة الألعاب العربية',
  },
};

export const viewport: Viewport = {
  themeColor: "#1ABB9C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`dark ${cairo.variable}`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased bg-background text-foreground`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <SettingsProvider>
              <SeoUpdater />
              <WebVitalsReporter />
              <SmoothScrollProvider>
                <Suspense fallback={null}>
                  <AppShell>
                    {children}
                  </AppShell>
                </Suspense>
              </SmoothScrollProvider>
              <Toaster />
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
