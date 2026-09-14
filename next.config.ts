import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // X-Frame-Options removed — managed solely in src/middleware.ts (DENY) to avoid conflict
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network https://telegram.org https://oauth.telegram.org",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com https://*.ytimg.com https://images.unsplash.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.supabase.co https://res.cloudinary.com https://telegram.org https://t.me https://iili.io https://freeimage.host https://*.freeimage.host https://img.gamesarabic.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://*.googlevideo.com https://*.ytimg.com https://www.youtube.com/oembed https://api.telegram.org",
      "frame-src 'self' https://js.stripe.com https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://youtu.be https://m.youtube.com https://music.youtube.com https://*.youtube.com https://*.youtube-nocookie.com https://oauth.telegram.org https://telegram.org",
      "media-src 'self' https://*.supabase.co https://*.youtube.com https://*.googlevideo.com https://*.ytimg.com",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      'recharts',
      'date-fns',
      'react-icons',
      'motion',
      '@tanstack/react-table',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [85, 75, 50],
    deviceSizes: [640, 750, 828, 1080, 1200],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: '**.igdb.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '**.supabase.in', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'telegram.org', pathname: '/**' },
      { protocol: 'https', hostname: 't.me', pathname: '/**' },
      { protocol: 'https', hostname: 'iili.io', pathname: '/**' },
      { protocol: 'https', hostname: 'freeimage.host', pathname: '/**' },
      { protocol: 'https', hostname: 'img.gamesarabic.com', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // Static pages
      { source: '/:path*', destination: '/support',   permanent: true, has: [{ type: 'query', key: 'view', value: 'support' }] },
      { source: '/:path*', destination: '/problems',  permanent: true, has: [{ type: 'query', key: 'view', value: 'problems' }] },
      { source: '/:path*', destination: '/about',     permanent: true, has: [{ type: 'query', key: 'view', value: 'about' }] },
      { source: '/:path*', destination: '/terms',     permanent: true, has: [{ type: 'query', key: 'view', value: 'terms' }] },
      { source: '/:path*', destination: '/privacy',   permanent: true, has: [{ type: 'query', key: 'view', value: 'privacy' }] },
      { source: '/:path*', destination: '/explore',   permanent: true, has: [{ type: 'query', key: 'view', value: 'explore' }] },
      { source: '/:path*', destination: '/community', permanent: true, has: [{ type: 'query', key: 'view', value: 'community' }] },
      // Removed landing page (was duplicate of settings entry section):
      // old /become-creator links go straight to the application form.
      { source: '/become-creator', destination: '/become-creator/apply', permanent: true },

      // Auth / Settings / Notifications
      { source: '/:path*', destination: '/login',         permanent: true, has: [{ type: 'query', key: 'view', value: 'login' }] },
      { source: '/:path*', destination: '/settings',      permanent: true, has: [{ type: 'query', key: 'view', value: 'settings' }] },
      { source: '/:path*', destination: '/notifications', permanent: true, has: [{ type: 'query', key: 'view', value: 'notifications' }] },
      { source: '/:path*', destination: '/upload',        permanent: true, has: [{ type: 'query', key: 'view', value: 'upload' }] },

      // List pages
      { source: '/:path*', destination: '/series', permanent: true, has: [{ type: 'query', key: 'view', value: 'series' }] },
      { source: '/:path*', destination: '/teams',  permanent: true, has: [{ type: 'query', key: 'view', value: 'teams' }] },
    ]
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  // NOTE: `hideSourceMaps` does not exist in @sentry/nextjs v10 (verified:
  // zero hits across node_modules/@sentry/** .d.ts). v10 equivalent that
  // keeps .map files out of the deployed output:
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
}));
