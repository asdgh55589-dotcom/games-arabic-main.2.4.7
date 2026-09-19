import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import bundleAnalyzer from "@next/bundle-analyzer";

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // X-Frame-Options removed — managed solely in src/proxy.ts (DENY) to avoid conflict
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // NOTE: Content-Security-Policy is set ONLY in src/proxy.ts addSecurityHeaders
  // (single source — the two definitions had drifted). Static-asset responses
  // served without the proxy don't need a document CSP.
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  reactCompiler: true,
  serverExternalPackages: [
    "@prisma/client",
    "bcryptjs",
    "exceljs",
    "cloudinary",
    "handlebars",
    "@sentry/nextjs",
    "@aws-sdk/client-s3",
    "sharp",
  ],
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
      'cloudinary',
      'handlebars',
      '@sentry/nextjs',
      '@uppy/core',
      '@uppy/dashboard',
      '@uppy/xhr-upload',
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
