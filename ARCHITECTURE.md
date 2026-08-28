# ARCHITECTURE.md — Games Arabic Project

> **Last Updated:** 2026-08-20

## Project Purpose

Games Arabic is an Arabic-first community platform for video game translation mods. Users can browse, upload, endorse, and download Arabic translation mods for games across multiple platforms (PC, PS1-PS4, Switch, Xbox). The platform supports translation teams, series grouping, user profiles with tier progression, and a full admin panel.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, standalone output) |
| **UI** | React 19, Tailwind CSS 4, shadcn/ui components |
| **Language** | TypeScript 5 (strict mode, `noImplicitAny: false`) |
| **Database** | PostgreSQL (Neon) via Prisma 6 ORM |
| **Auth** | Supabase Auth (Google, Discord, Telegram OAuth) + JWT cookies |
| **State** | Zustand (client), React Query (data fetching) |
| **Validation** | Zod 4 schemas |
| **Cache** | Upstash Redis (rate limiting, IP ban cache) |
| **Email** | Resend |
| **Animation** | Framer Motion |
| **Charts** | Recharts |
| **Markdown** | MDX Editor, react-markdown, DOMPurify |

## Architecture: File-Based Routing

The app uses **Next.js App Router file-based routing**. Each page has its own route file in `src/app/` with `generateMetadata` for SEO. View components live in `src/views/` and are imported by route pages.

```
 /                              → HomePage (static metadata)
 /mod/my-mod                    → ModDetailPage (useParams for slug)
 /games                         → GamesPage
 /games/god-of-war              → GameDetailPage (useParams for slug)
 /series                        → SeriesPage
 /series/god-of-war             → SeriesDetailPage (useParams for slug)
 /teams                         → TranslationTeamsPage
 /teams/my-team                 → TeamDetailPage (useParams for slug)
 /profile/ahmed                 → ProfilePage (useParams for user)
 /platform/PC                   → PlatformPage (useParams for key)
 /search?q=god+of+war           → SearchPage (useSearchParams for q)
 /favorites                     → FavoritesPage (bookmarks)
 /upload, /login, /notifications, /settings → Auth/config pages
 /about, /support, /explore, /community… → Static pages
```

### How It Works

1. Each route has a `src/app/<route>/page.tsx` file
2. Route pages are server components that import client view components from `src/views/`
3. Dynamic routes use `useParams()` for path segments (replacing `useSearchParams()`)
4. Each route page exports `generateMetadata` for SEO (title, description, Open Graph)
5. Shared layout (Navbar + Footer) wraps all pages via `AppShell` in `src/app/layout.tsx`

### Shared Layout

```
src/app/layout.tsx
├── <html dir="rtl">
│   └── <body>
│       └── <AppShell>           ← src/components/layout/app-shell.tsx
│           ├── <Navbar />       ← uses usePathname() for active state
│           ├── <Suspense>
│           │   └── {children}   ← route pages render here
│           ├── <Footer />
│           ├── <BookmarksProvider>
│           └── <ErrorBoundary>
```

### Benefits of File-Based Routing

- **SEO** — Each page has unique `<title>`, `<meta>`, Open Graph tags via `generateMetadata`
- **Meaningful URLs** — `/mod/my-mod` instead of `/?view=mod&slug=my-mod`
- **Deep linking** — URLs are shareable and bookmarkable
- **Static generation** — Popular pages can be pre-rendered
- **Browser history** — Proper back/forward navigation
- **Code splitting** — Each route loads independently

## Folder Structure

```
games-arabic-main/
├ src/
│   ├── app/                    # Next.js App Router (file-based)
│   │   ├── page.tsx            # Home page (HomePage + generateMetadata)
│   │   ├── layout.tsx          # Root layout (AppShell + Suspense)
│   │   ├── globals.css         # Global styles (oklch, gradients, RTL)
│   │   ├── mod/[slug]/page.tsx # Mod detail route (dynamic)
│   │   ├── games/              # Game routes
│   │   │   ├── page.tsx        # Games list
│   │   │   └── [slug]/page.tsx # Game detail
│   │   ├── series/             # Series routes
│   │   │   ├── page.tsx        # Series list
│   │   │   └── [slug]/page.tsx # Series detail
│   │   ├── teams/              # Teams routes
│   │   │   ├── page.tsx        # Teams list
│   │   │   └── [slug]/page.tsx # Team detail
│   │   ├── profile/[user]/     # User profile (dynamic)
│   │   ├── platform/[key]/     # Platform page (dynamic)
│   │   ├── search/             # Search (?q= query)
│   │   ├── favorites/          # Favorites (bookmarked mods)
│   │   ├── upload/             # Upload mod
│   │   ├── login/              # Login
│   │   ├── notifications/      # Notifications
│   │   ├── settings/           # Settings
│   │   ├── about/              # About
│   │   ├── support/            # Support
│   │   ├── explore/            # Explore
│   │   ├── community/          # Community
│   │   ├── problems/           # Problems
│   │   ├── terms/              # Terms
│   │   ├── privacy/            # Privacy
│   │   ├── api/                # API route handlers (147 handlers)
│   │   │   ├── mods/           # /api/mods (+ [slug]/endorse|download|comments)
│   │   │   ├── games/          # /api/games
│   │   │   ├── series/         # /api/series
│   │   │   ├── teams/          # /api/teams
│   │   │   ├── users/          # /api/users/[username]/*
│   │   │   ├── auth/           # /api/auth/* (callback, telegram, me)
│   │   │   ├── bookmarks/      # /api/bookmarks
│   │   │   ├── notifications/  # /api/notifications
│   │   │   ├── reports/        # /api/reports
│   │   │   ├── sections/       # /api/sections (dynamic platforms)
│   │   │   ├── admin/          # /api/admin/* (protected, 100+ routes)
│   │   │   └── ...
│   │   └── admin/              # Admin panel pages (22+ sections, SSR)
│   ├── views/                  # View components (imported by routes, 26 files)
│   │   ├── home.tsx
│   │   ├── mod-detail.tsx
│   │   ├── game-detail.tsx
│   │   ├── favorites.tsx
│   │   ├── platform.tsx
│   │   ├── profile.tsx
│   │   └── ...
│   ├── components/             # Shared React components
│   │   ├── ui/                 # shadcn/ui primitives (40+)
│   │   ├── layout/             # AppShell, Navbar, Footer, ErrorBoundary
│   │   ├── admin/              # Admin-specific components
│   │   └── ...                 # Feature components (mod-card, hero-slider…)
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-fetch.ts        # Data fetching with cancellation
│   │   ├── use-team-detail.ts  # Team detail (useParams)
│   │   └── ...
│   ├── contexts/               # AuthContext, SettingsContext, BookmarksContext
│   ├── lib/                    # Shared utilities and services (35+ files)
│   │   ├── api-response.ts     # Standardized API response helpers
│   │   ├── api-client.ts       # Client-side fetch wrapper (ApiError)
│   │   ├── api-utils.ts        # Query param parsing, pagination, serialize
│   │   ├── auth.ts             # Auth helpers (session, roles, JWT)
│   │   ├── db.ts               # Prisma client singleton (5 conn, 30s)
│   │   ├── schemas.ts          # Zod validation schemas (centralized)
│   │   ├── types.ts            # Shared TypeScript types
│   │   ├── ip-ban-cache.ts     # Upstash Redis IP ban (Edge-safe)
│   │   ├── token-version-cache.ts # TokenVersion Redis (Edge-safe)
│   │   ├── rate-limit.ts       # Rate limiting
│   │   ├── supabase/           # Supabase client setup
│   │   └── ...
│   └── middleware.ts           # Edge middleware (auth, IP bans, ?view= redirects, CSP/HSTS)
├ prisma/
│   └── schema.prisma           # Database schema (40+ models)
├ public/                       # Static assets
├ scripts/                      # Seed scripts, utilities
├ docs/                         # Documentation (15 files)
├ next.config.ts                # Next.js config (standalone, redirects, headers)
├ tailwind.config.ts            # Tailwind CSS config
├ tsconfig.json                 # TypeScript config (@/* alias)
└ package.json                  # Dependencies and scripts
```

## Key Design Decisions

### 1. File-Based Routing with View Components

**Decision:** Use Next.js App Router file-based routing with view components in `src/views/`.

**Why:** Each route gets its own page file with `generateMetadata` for SEO. View components remain in `src/views/` for code organization and reuse. The route pages are thin wrappers that handle params and metadata.

### 2. Supabase Auth + Neon DB

**Decision:** Use Supabase for OAuth flows but store user data in Neon (Prisma).

**Why:** Supabase Auth handles OAuth complexity (Google, Discord, Telegram) but the app needs rich relational data (mods, games, teams) that's better suited to a dedicated PostgreSQL database. The `syncNeonUser()` function bridges the two.

### 3. JWT Role Cookie for Middleware

**Decision:** Sign a `ga_admin_role` JWT cookie for Edge middleware authorization.

**Why:** Edge middleware can't use Prisma (Node-only). The JWT cookie carries `userId`, `role`, and `tokenVersion` so the middleware can protect `/admin/*` routes without a database call. The `tokenVersion` field allows instant session invalidation.

### 4. IP Ban via Redis Cache

**Decision:** Cache IP bans in Upstash Redis for Edge-compatible checks.

**Why:** The middleware runs in Edge runtime and can't query the database. Redis provides a fast, Edge-compatible cache. The full ban check happens server-side in `requireAuth()`.

### 5. Centralized Zod Schemas

**Decision:** All validation schemas live in `src/lib/schemas.ts`.

**Why:** Single source of truth for API input validation. Routes use `safeParse()` + `validationFail()` for consistent error responses.

### 6. Standardized API Responses

**Decision:** All API routes return `{ data }`, `{ data, pagination }`, or `{ error: { code, message } }`.

**Why:** Consistent contract between backend and frontend. The `apiFetch()` client and `useFetch` hook rely on this shape.

## Database

PostgreSQL hosted on Neon, accessed via Prisma ORM.

**Key Models:** User, Game, Mod, ModFile, Series, Team, Section, Notification, Report, Ticket, Achievement (40+ models including OAuthAccount, ModVersion, WorkflowEntry, DownloadClick, ScheduledJob)

**Connection:** 5 connection pool, 30s timeout (serverless-optimized)

See [docs/DATABASE.md](docs/DATABASE.md) for full schema documentation.

## Authentication

- **OAuth:** Google, Discord, Telegram Deep Link via Supabase Auth
- **JWT Cookie:** `ga_admin_role` for Edge-compatible admin protection (validated against `tokenVersion` Redis cache)
- **Roles:** owner > manager > admin > moderator > publisher > member (`requireAdmin()` accepts manager/admin/owner)
- **Session:** Supabase session refreshed on every request via middleware (8s timeout, fail-open; admin routes use JWT cookie alone)

See [docs/AUTH-SYSTEM.md](docs/AUTH-SYSTEM.md) for complete documentation.

## Deployment

- **Runtime:** Next.js standalone output on Node.js
- **Database:** Neon PostgreSQL (serverless)
- **Auth:** Supabase (hosted)
- **Cache:** Upstash Redis (serverless)
- **Build:** `prisma generate → prisma migrate deploy → next build → copy standalone`

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment details.

## Running Locally

```bash
# 1. Install dependencies
bun install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Push database schema
bun run db:push

# 4. Generate Prisma client
bun run db:generate

# 5. Start dev server
bun run dev
```

Dev server runs on `http://localhost:3000`.
