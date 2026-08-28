# Routing Architecture

> **Last Updated:** 2026-08-20 — File-based routing migrated from `?view=` in v0.3.0

## Architecture: File-Based Routing

The app uses **Next.js App Router file-based routing**. Each page has its own route file in `src/app/` with `generateMetadata` for SEO. View components live in `src/views/` and are imported by thin route page wrappers.

## Route Structure

### Public Pages (23 routes — 17 static + 6 dynamic)

| Route | Type | View Component | SEO Metadata |
|-------|------|----------------|--------------|
| `/` | Static | `HomePage` | Title, description, OG, canonical |
| `/mod/[slug]` | Dynamic | `ModDetailPage` | Fetched from `/api/mods/[slug]` |
| `/games` | Static | `GamesPage` | Static metadata |
| `/games/[slug]` | Dynamic | `GameDetailPage` | Fetched from API |
| `/series` | Static | `SeriesPage` | Static metadata |
| `/series/[slug]` | Dynamic | `SeriesDetailPage` | Fetched from API |
| `/teams` | Static | `TranslationTeamsPage` | Static metadata |
| `/teams/[slug]` | Dynamic | `TeamDetailPage` | Fetched via `useTeamDetail` hook |
| `/profile/[user]` | Dynamic | `ProfilePage` | Fetched from `/api/users/[user]/full-profile` |
| `/platform/[key]` | Dynamic | `PlatformPage` | Static per platform (`PC`, `PS4`…) |
| `/search` | Static | `SearchPage` | Static + `?q=` query |
| `/favorites` | Static | `FavoritesPage` | Static (auth — bookmarks) |
| `/upload` | Static | `UploadPage` | Static (publisher+) |
| `/login` | Static | `LoginPage` | Static (noindex) |
| `/notifications` | Static | `NotificationsPage` | Static (noindex) |
| `/settings` | Static | `SettingsPage` | Static (noindex) |
| `/about` | Static | `AboutPage` | Static metadata |
| `/support` | Static | `SupportPage` | Static metadata |
| `/explore` | Static | `ExplorePage` | Static metadata |
| `/community` | Static | `CommunityPage` | Static metadata |
| `/problems` | Static | `ProblemsPage` | Static metadata |
| `/terms` | Static | `TermsPage` | Static (noindex) |
| `/privacy` | Static | `PrivacyPage` | Static (noindex) |

### Admin Pages (22+ routes)

All under `/admin/*` — protected by Edge middleware JWT role cookie (no Supabase call). Includes `/admin/login` (public) + dashboard, mods, games, series, teams, users, comments, endorsements, reports, settings, tiers, special-roles, audit, tier-history, news, ads, analytics, templates, notifications-health, tickets, scheduler, sections, etc.

### API Routes (147 handlers)

All under `/api/*` — standard REST endpoints (`src/app/api/**/route.ts`). Not affected by file-route migration. See `docs/API-STANDARDIZATION.md` for full endpoint tables.

## Route Page Pattern

Every route follows the same pattern:

```typescript
// src/app/your-route/page.tsx
import type { Metadata } from 'next'
import { YourPage } from '@/views/your-view'

// Server component metadata (SEO)
export const metadata: Metadata = {
  title: 'Page Title — GAMES ARABIC',
  description: 'Page description for SEO',
}

// or for dynamic routes:
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  // Fetch data and return metadata
}

// Thin wrapper that renders the client view component
export default function YourRoutePage() {
  return <YourPage />
}
```

## Dynamic Routes

Dynamic routes use `useParams()` for path segments:

```typescript
// src/views/mod-detail.tsx
'use client'
import { useParams } from 'next/navigation'

export function ModDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  // ...
}
```

**Parameter mapping (old → new):**

| Old Param | New Route Segment | View |
|-----------|------------------|------|
| `?slug=` | `/mod/[slug]` | ModDetailPage |
| `?slug=` | `/games/[slug]` | GameDetailPage |
| `?series=` | `/series/[slug]` | SeriesDetailPage |
| `?team=` | `/teams/[slug]` | TeamDetailPage |
| `?user=` | `/profile/[user]` | ProfilePage |
| `?platform=` | `/platform/[key]` | PlatformPage |
| `?q=` | `?q=` (query param) | SearchPage |

## Redirects (Backwards Compatibility)

### Static Redirects (next.config.ts)

13 permanent redirects for simple view→route mappings:

```typescript
// next.config.ts
async redirects() {
  return [
    { source: '/:path*', destination: '/support',   permanent: true, has: [{ type: 'query', key: 'view', value: 'support' }] },
    { source: '/:path*', destination: '/problems',  permanent: true, has: [{ type: 'query', key: 'view', value: 'problems' }] },
    { source: '/:path*', destination: '/about',     permanent: true, has: [{ type: 'query', key: 'view', value: 'about' }] },
    { source: '/:path*', destination: '/terms',     permanent: true, has: [{ type: 'query', key: 'view', value: 'terms' }] },
    { source: '/:path*', destination: '/privacy',   permanent: true, has: [{ type: 'query', key: 'view', value: 'privacy' }] },
    { source: '/:path*', destination: '/explore',   permanent: true, has: [{ type: 'query', key: 'view', value: 'explore' }] },
    { source: '/:path*', destination: '/community', permanent: true, has: [{ type: 'query', key: 'view', value: 'community' }] },
    { source: '/:path*', destination: '/login',         permanent: true, has: [{ type: 'query', key: 'view', value: 'login' }] },
    { source: '/:path*', destination: '/settings',      permanent: true, has: [{ type: 'query', key: 'view', value: 'settings' }] },
    { source: '/:path*', destination: '/notifications', permanent: true, has: [{ type: 'query', key: 'view', value: 'notifications' }] },
    { source: '/:path*', destination: '/upload',        permanent: true, has: [{ type: 'query', key: 'view', value: 'upload' }] },
    { source: '/:path*', destination: '/series', permanent: true, has: [{ type: 'query', key: 'view', value: 'series' }] },
    { source: '/:path*', destination: '/teams',  permanent: true, has: [{ type: 'query', key: 'view', value: 'teams' }] },
  ]
}
```

### Parametric Redirects (middleware.ts)

5 redirects that need query→path segment mapping (handled in Edge middleware):

```typescript
// src/middleware.ts
switch (view) {
  case 'platform':  → `/platform/${platform}`
  case 'profile':   → `/profile/${user}`
  case 'series-detail': → `/series/${series}`
  case 'team-detail':   → `/teams/${team}`
  case 'search':    → `/search?q=${q}`
}
```

### Redirect Coverage

| Old URL | New URL | Handler |
|---------|---------|---------|
| `/?view=support` | `/support` | next.config.ts |
| `/?view=problems` | `/problems` | next.config.ts |
| `/?view=about` | `/about` | next.config.ts |
| `/?view=terms` | `/terms` | next.config.ts |
| `/?view=privacy` | `/privacy` | next.config.ts |
| `/?view=explore` | `/explore` | next.config.ts |
| `/?view=community` | `/community` | next.config.ts |
| `/?view=login` | `/login` | next.config.ts |
| `/?view=settings` | `/settings` | next.config.ts |
| `/?view=notifications` | `/notifications` | next.config.ts |
| `/?view=upload` | `/upload` | next.config.ts |
| `/?view=series` | `/series` | next.config.ts |
| `/?view=teams` | `/teams` | next.config.ts |
| `/?view=platform&platform=PC` | `/platform/PC` | middleware.ts |
| `/?view=profile&user=ahmed` | `/profile/ahmed` | middleware.ts |
| `/?view=series-detail&series=xyz` | `/series/xyz` | middleware.ts |
| `/?view=team-detail&team=xyz` | `/teams/xyz` | middleware.ts |
| `/?view=search&q=xxx` | `/search?q=xxx` | middleware.ts |

## SEO Metadata

### Static Routes

Export `metadata` object:

```typescript
export const metadata: Metadata = {
  title: 'Page Title — GAMES ARABIC',
  description: 'Page description',
  openGraph: { title, description, type: 'website', siteName: 'GAMES ARABIC' },
}
```

### Dynamic Routes

Export `generateMetadata` function:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const res = await fetch(`/api/your-resource/${slug}`)
  const { data } = await res.json()

  return {
    title: `${data.name} — GAMES ARABIC`,
    description: data.description?.slice(0, 160),
    openGraph: {
      title,
      description,
      images: [{ url: data.imageUrl, width: 1200, height: 630 }],
    },
  }
}
```

### Noindex Routes

Routes that shouldn't be indexed by search engines:

```typescript
export const metadata: Metadata = {
  title: 'Page — GAMES ARABIC',
  robots: { index: false, follow: false },
}
```

Used for: `/login`, `/settings`, `/notifications`

## Shared Layout

`src/app/layout.tsx` wraps all pages in `AppShell`:

```typescript
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html dir="rtl">
      <body>
        <AppShell>
          <Suspense fallback={<Loading />}>
            {children}
          </Suspense>
        </AppShell>
      </body>
    </html>
  )
}
```

`AppShell` provides: Navbar (with `usePathname()` active state), Footer, BookmarksProvider, ErrorBoundary, ScrollToTop.

## API Routes (Unchanged)

API routes remain at `/api/*` and are not affected by this migration. They already use proper REST-style URLs:

```
GET  /api/mods
GET  /api/mods/[slug]
POST /api/mods/[slug]/endorse
GET  /api/games
GET  /api/games/[slug]
GET  /api/teams
GET  /api/teams/[slug]
```
