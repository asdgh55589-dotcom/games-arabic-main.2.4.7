# Frontend Architecture

> **Last Updated:** 2026-08-20

## Overview

The frontend is built with React 19, Tailwind CSS 4, and shadcn/ui components. It follows an Arabic-first (RTL, `dir="rtl"` on `<html>`) design approach with file-based routing (Next.js App Router).

## Component Structure

### Directory Layout

```
src/
├── components/           # Shared components
│   ├── ui/               # shadcn/ui primitives (Button, Dialog, etc.)
│   ├── layout/           # Layout components (Header, Sidebar)
│   ├── admin/            # Admin-specific components
│   └── ...               # Feature components
├── views/                # Page-level components (SPA views)
├── hooks/                # Custom React hooks
├── contexts/             # React contexts
└── lib/                  # Utilities and services
```

### Component Categories

#### UI Primitives (`src/components/ui/`)

shadcn/ui components built on Radix UI:

```
button.tsx, dialog.tsx, dropdown-menu.tsx, input.tsx,
select.tsx, tabs.tsx, toast.tsx, tooltip.tsx, etc.
```

#### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| `Navbar` | `components/navbar.tsx` | Top navigation bar with game dropdown |
| `Footer` | `components/footer.tsx` | Site footer |
| `HomeSidebar` | `components/home-sidebar.tsx` | Homepage sidebar |
| `ScrollToTop` | `components/scroll-to-top.tsx` | Scroll to top button |

#### Feature Components

| Component | File | Purpose |
|-----------|------|---------|
| `ModCard` | `components/mod-card.tsx` | Mod preview card |
| `GameCard` | `components/game-card.tsx` | Game preview card |
| `HeroSlider` | `components/hero-slider.tsx` | Homepage hero carousel |
| `NewsTicker` | `components/news-ticker.tsx` | Scrolling news ticker |
| `NewsFeatured` | `components/news-featured.tsx` | Featured news section |
| `ModComments` | `components/mod-comments.tsx` | Comment section |
| `ModDownloadSection` | `components/mod-download-section.tsx` | Download buttons |
| `ModGallery` | `components/mod-gallery.tsx` | Image gallery |
| `ModVideos` | `components/mod-videos.tsx` | Video embeds |
| `ModTranslationTeam` | `components/mod-translation-team.tsx` | Team info |
| `NotificationBell` | `components/notification-bell.tsx` | Notification icon |
| `NotificationDropdown` | `components/notification-dropdown.tsx` | Notification list |
| `ReportButton` | `components/report-button.tsx` | Report content |
| `TierBadge` | `components/tier-badge.tsx` | User tier badge |
| `SpecialRoleBadge` | `components/special-role-badge.tsx` | Special role badge |

### Views (`src/views/` — 26 files)

Each view is a client component (`'use client'`) imported by a thin server route wrapper in `src/app/<route>/page.tsx`. Dynamic views use `useParams()` for slugs.

| View | File | Route(s) | Description |
|------|------|----------|-------------|
| `HomePage` | `views/home.tsx` | `/` | Homepage with hero, platforms, sidebar |
| `ModDetailPage` | `views/mod-detail.tsx` | `/mod/[slug]` | Mod detail (useParams `slug`) |
| `GameDetailPage` | `views/game-detail.tsx` | `/games/[slug]` | Game detail (useParams `slug`) |
| `GamesPage` | `views/games.tsx` | `/games` | Games listing |
| `ModsPage` | `views/mods.tsx` | `/mods` (optional) | Mods listing + filters |
| `SearchPage` | `views/search.tsx` | `/search?q=` | Search results (`useSearchParams`) |
| `FavoritesPage` | `views/favorites.tsx` | `/favorites` | Bookmarked mods |
| `UploadPage` | `views/upload.tsx` | `/upload` | Upload new mod |
| `ProfilePage` | `views/profile.tsx` | `/profile/[user]` | User profile (useParams `user`) |
| `LoginPage` | `views/login.tsx` | `/login` | Login (OAuth + Telegram) |
| `SeriesPage` | `views/series.tsx` | `/series` | Series list |
| `SeriesDetailPage` | `views/series-detail.tsx` | `/series/[slug]` | Series detail |
| `TranslationTeamsPage` | `views/translation-teams.tsx` | `/teams` | Teams list |
| `TeamDetailPage` | `views/team-detail.tsx` | `/teams/[slug]` | Team detail |
| `PlatformPage` | `views/platform.tsx` | `/platform/[key]` | Platform mods (useParams `key`) |
| `SupportPage` | `views/support.tsx` | `/support` | Support page |
| `ExplorePage` | `views/explore.tsx` | `/explore` | Explore page |
| `CommunityPage` | `views/community.tsx` | `/community` | Community page |
| `AboutPage` | `views/about.tsx` | `/about` | About page |
| `ProblemsPage` | `views/problems.tsx` | `/problems` | Known problems |
| `TermsPage` | `views/terms.tsx` | `/terms` | Terms |
| `PrivacyPage` | `views/privacy.tsx` | `/privacy` | Privacy |
| `NotificationsPage` | `views/notifications.tsx` | `/notifications` | Notifications list |
| `NotificationSettingsPage` | `views/notification-settings.tsx` | `/notifications` (settings tab) | Notification preferences |
| `SettingsPage` | `views/settings.tsx` | `/settings` | User settings |
| `ComingSoonPage` | `views/coming-soon.tsx` | fallback | Placeholder for unknown views |

## State Management

### Client State: Zustand

Used for global UI state (e.g., bookmarks via `BookmarksContext` backed by Zustand-like patterns).

### Server State: `useFetch` + React Query

- **Primary: `useFetch`** (`src/hooks/use-fetch.ts`) — custom hook with AbortController cancellation, stale-response guard, and refetch. Used in 90% of views.
- **React Query** (`@tanstack/react-query` v5) — installed and available for advanced caching/optimistic updates, but not mandatory. Use `useFetch` for simple lists, React Query for complex mutations/caching.

### Custom `useFetch` Hook

Located at `src/hooks/use-fetch.ts`. Provides:

- Automatic fetching on mount
- Cancellation on unmount (AbortController)
- Stale response protection
- Refetch support
- Loading/error states

```typescript
const { data, loading, error, refetch } = useFetch<T>(
  url,    // string | null (null = skip)
  deps    // dependency array for refetch
)
```

**Usage pattern:**

```typescript
function MyComponent() {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useFetch<PaginatedMods>(
    `/api/mods?page=${page}`,
    [page]
  )

  if (loading) return <Spinner />
  if (error) return <ErrorMessage error={error} />

  // data follows API response format: { data: [...], pagination: {...} }
  const mods = data?.data ?? []
  const pagination = data?.pagination

  return <ModList mods={mods} pagination={pagination} />
}
```

### `apiFetch` Client

Located at `src/lib/api-client.ts`. For mutations and direct API calls:

```typescript
import { apiFetch, ApiError } from '@/lib/api-client'

try {
  const response = await apiFetch<{ data: Mod }>('/api/mods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(modData),
  })
  const mod = response.data
} catch (e) {
  if (e instanceof ApiError) {
    console.error(e.status, e.message)
  }
}
```

## API Response Consumption

All API responses follow the standard format:

```typescript
// Single resource: { data: T }
// Paginated: { data: T[], pagination: {...} }

const { data } = await fetch('/api/mods').then(r => r.json())

// data.data contains the actual payload
// data.pagination contains page info (if paginated)
```

In components:

```typescript
const { data } = useFetch<PaginatedResponse<ModSummary[]>>('/api/mods')

const mods = data?.data ?? []
const { page, limit, total, totalPages } = data?.pagination ?? { page: 1, limit: 24, total: 0, totalPages: 0 }
```

## Styling Approach

### Tailwind CSS 4

All styling uses Tailwind utility classes. Configuration in `tailwind.config.ts`.

### RTL Support

The app is Arabic-first with `dir="rtl"` on `<html>`. Tailwind's RTL support is used throughout:

```html
<html lang="ar" dir="rtl">
```

### shadcn/ui

Components are in `src/components/ui/`. Built on:
- Radix UI primitives
- class-variance-authority (CVA) for variants
- tailwind-merge for class merging
- clsx for conditional classes

### Theme

Uses `next-themes` for dark/light mode support via `ThemeProvider`.

## Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useFetch` | `hooks/use-fetch.ts` | Data fetching with cancellation |
| `useDebounced` | `hooks/use-debounced.ts` | Debounced values |
| `useDocumentTitle` | `hooks/use-document-title.ts` | Set page title |
| `useMobile` | `hooks/use-mobile.ts` | Detect mobile viewport |
| `useSmoothWheelScroll` | `hooks/use-smooth-wheel-scroll.ts` | Smooth scroll behavior |
| `useStickySidebar` | `hooks/use-sticky-sidebar.ts` | Sticky sidebar positioning |
| `useTeamDetail` | `hooks/use-team-detail.ts` | Team detail data fetching |
| `useToast` | `hooks/use-toast.ts` | Toast notifications |

## Provider Structure

```typescript
// src/app/layout.tsx
<html lang="ar" dir="rtl" className="dark">
  <body>
    <ThemeProvider attribute="class" defaultTheme="dark">
      <AuthProvider>                 {/* Supabase session + user */}
        <SettingsProvider>           {/* Site settings */}
          <SeoUpdater />             {/* GA + theme-color */}
          <SmoothScrollProvider>     {/* Lenis smooth scroll */}
            <Suspense fallback={null}>
              <AppShell>             {/* Navbar + main + Footer + BookmarksProvider + ErrorBoundary */}
                {children}           {/* file-route page renders here */}
              </AppShell>
            </Suspense>
          </SmoothScrollProvider>
          <Toaster />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  </body>
</html>
```

## Key Patterns

### File-Based Route Wrappers (no lazy import needed)

Each route is a server component that statically imports its view. Code-splitting is automatic per route in Next.js 16:

```typescript
// src/app/favorites/page.tsx
import type { Metadata } from 'next'
import { FavoritesPage } from '@/views/favorites'
export const metadata: Metadata = { title: 'المفضلة — GAMES ARABIC', ... }
export default function FavoritesRoutePage() { return <FavoritesPage /> }
```

Dynamic routes add `generateMetadata()` + `useParams()` in the view.

### Conditional Fetching

```typescript
const { data } = useFetch(url, [userId])
// Pass null as URL to skip fetching
const { data } = useFetch(userId ? `/api/users/${userId}` : null, [userId])
```

### Form Handling

Uses `react-hook-form` with `@hookform/resolvers` for Zod integration:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateModSchema } from '@/lib/schemas'

const form = useForm({
  resolver: zodResolver(CreateModSchema),
  defaultValues: { name: '', summary: '' },
})
```

### Error Handling

Components use `ErrorBoundary` for runtime errors:

```typescript
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

API errors are handled via `ApiError` class:

```typescript
try {
  await apiFetch('/api/mods', { method: 'POST', body: ... })
} catch (e) {
  if (e instanceof ApiError && e.status === 422) {
    // Validation error
  }
}
```
