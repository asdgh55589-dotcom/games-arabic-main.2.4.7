# Changelog

> **Last Updated:** 2026-08-20

All notable architectural changes to the Games Arabic project.

## [0.4.0] - 2026-08-20

### Added — Security & Auth Hardening

- **CSP + HSTS headers** in `src/middleware.ts` (`Strict-Transport-Security: max-age=31536000`, CSP with `script-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'`, etc.) + mirrored in `next.config.ts`
- **Rate limiting** via Upstash Redis on sensitive API routes (auth/comments/mods)
- **`tokenVersion` Redis cache** (`src/lib/token-version-cache.ts`) — Edge middleware validates JWT `tv` against `getTokenVersionCache(userId)` with 1s `Promise.race` timeout (fail-open). `invalidateUserSessions()` now writes to Redis so bans/role changes are instant even in Edge.
- **`requireAdmin()` now accepts `manager` role** (owner > manager > admin > moderator > publisher > member hierarchy)
- **Middleware IP ban check is now write-only** — `GET /api/mods`, `/api/games` etc. are not checked, preventing Redis failures from blocking reads

### Changed

- **Env template simplified** — `.env.example` now only requires `DATABASE_URL`, `DIRECT_URL`, Supabase vars, `JWT_SECRET`, `OWNER_*`, `NEXT_PUBLIC_SITE_URL`; OAuth IDs moved to Supabase Dashboard; `TELEGRAM_*`, `RESEND_*`, `UPSTASH_*`, `YT_DLP_PATH` are optional
- **Schema expanded to 53 models** — added `Section`, `DownloadClick`, `ScheduledJob`, `ModRating`, `Ticket`/`TicketMessage`/`TicketTag`, `Achievement`/`TeamAchievement`/`TeamPoints`/`PointsTransaction`, `SavedSearch`, `ReportStatusHistory`, `ModVersion`, `WorkflowEntry`, `OAuthAccount` and fields `translationScope`, `sectionId`, `telegramUrl`, `telegramUrl` on Team, `qualityScore` etc. (see `prisma/schema.prisma`)
- **API count: 147 handlers** — new public endpoints: `/api/sections`, `/api/storage/upload-url`, `/api/bookmarks/check-batch`, `/api/notifications/preferences`, etc.; 100+ admin handlers now grouped in `docs/API-STANDARDIZATION.md`
- **Zod schemas centralized** — `src/lib/schemas.ts` now includes `NotificationTypeSchema` (20 types), `NotificationChannelSchema`, `CreateTemplateSchema`, `UpdatePreferencesSchema`, `sectionId`, `translationScope`, `isAllowedDownloadUrl` refinement, and role enum `member | publisher | moderator | manager | admin | owner`

### Documentation — 2026-08-20 Refresh

- Updated `AGENTS.md` — fixed contradictory SPA/file-based routing description, expanded role hierarchy, documented `tokenVersion` + `ip-ban-cache` Edge checks, 147 handlers, 40+ models, and `?view=` 301 redirects
- Rewrote `TECHNICAL.md` sections — replaced SPA `?view=` diagram with file-based architecture (26 views, 147 handlers, 40+ models), added `favorites` route, corrected middleware flow (8s Supabase timeout, fail-open, write-only IP ban), and updated provider structure (`AuthProvider`, `SettingsProvider`, `AppShell`)
- Refreshed `ARCHITECTURE.md` — updated folder structure (favorites, sections, token-version-cache), route table, and DB/auth summaries
- Updated `docs/FRONTEND-ARCHITECTURE.md` — 26 views with routes, `useFetch` + React Query status, provider tree, file-based wrapper pattern (no `next/dynamic` lazy-loading)
- Expanded `docs/DATABASE.md` — 53 models (was 30+), updated `User.role` enum, added `Mod.workflowStatus`/`sectionId`/`qualityScore`, documented notification/ report / ticket / achievement subsystems, refreshed relations diagram
- Fixed `docs/AUTH-SYSTEM.md` — 6-role hierarchy, write-only IP ban logic, JWT + `tokenVersion` Redis validation, Edge runtime summary (jose + both caches)
- Refreshed `docs/API-STANDARDIZATION.md` — public endpoints grouped (sections, bookmarks batch, notifications preferences, YouTube metadata, settings robots/sitemap), auth endpoints with Telegram webhook/poll, admin endpoints to 100+ handlers
- Updated `docs/ZOD-SCHEMAS.md` — added `sectionId`, `translationScope`, `isAllowedDownloadUrl` refinement, expanded `CreateUserSchema` role enum, added `telegramUrl` to `CreateTeamSchema`, and full notification schemas (20 types, template, preferences)
- Updated `docs/ROUTING-ARCHITECTURE.md` — 23 public routes (17 static + 6 dynamic) including `/favorites`, admin 22+ sections, API 147 handlers
- Updated `docs/DEVELOPMENT-GUIDE.md` + `docs/README.md` — project structure with `favorites`, 35+ lib files, 147 handlers
- Updated `docs/DEPLOYMENT.md` — new env vars (`DIRECT_URL`, `OWNER_*`, `YT_DLP_PATH`), Upstash and Resend as optional, OAuth via Supabase Dashboard
- Updated `README.md` — Quick Start with `db:push`/`db:generate`, tech stack (53 models, 147 handlers, yt-dlp), commands, architecture docs links
- Verified: all docs now pass `AGENTS.md` critical rule (accurate routing, roles, middleware, and schema)

## [0.3.0] - 2026-08-11

### Added — SPA to File-Based Routing Migration

Migrated from single-page architecture (`?view=` query params) to Next.js App Router file-based routing.

#### New Route Pages (20 public routes)

- `/` — Home page (server component with metadata)
- `/mod/[slug]` — Mod detail (dynamic, `generateMetadata` from API)
- `/games` — Games list (static metadata)
- `/games/[slug]` — Game detail (dynamic, `generateMetadata` from API)
- `/series` — Series list (static metadata)
- `/series/[slug]` — Series detail (dynamic, `generateMetadata` from API)
- `/teams` — Teams list (static metadata)
- `/teams/[slug]` — Team detail (dynamic, `generateMetadata` from API)
- `/profile/[user]` — User profile (dynamic, `generateMetadata` from API)
- `/platform/[key]` — Platform page (dynamic, static metadata per platform)
- `/search` — Search (query param `?q=`)
- `/upload` — Upload mod
- `/login` — Login (noindex)
- `/notifications` — Notifications (noindex)
- `/settings` — Settings (noindex)
- `/about` — About page
- `/support` — Support page
- `/explore` — Explore platforms
- `/community` — Community page
- `/problems` — Problems and solutions
- `/terms` — Terms of service (noindex)
- `/privacy` — Privacy policy (noindex)

#### Shared Layout

- Created `src/components/layout/app-shell.tsx` — wraps all pages with Navbar, Footer, BookmarksProvider, ErrorBoundary, ScrollToTop
- Updated `src/app/layout.tsx` — wraps children in `<AppShell>` with `<Suspense>` boundary
- Updated `src/components/navbar.tsx` — uses `usePathname()` + `useSearchParams()` for active state detection (supports both old `?view=` and new `/route` URLs)

#### SEO Metadata

- Added `generateMetadata` to all 20 route pages
- Dynamic routes fetch data for accurate titles, descriptions, and Open Graph images
- Static routes export `metadata` objects
- Noindex routes for auth/settings/notifications pages

#### Backwards Compatibility Redirects

**next.config.ts** — 13 permanent redirects for simple view→route mappings:
- Static pages: support, problems, about, terms, privacy, explore, community
- Auth/settings: login, settings, notifications, upload
- List pages: series, teams

**middleware.ts** — 5 parametric redirects for query→path segment mapping:
- `/?view=platform&platform=PC` → `/platform/PC`
- `/?view=profile&user=ahmed` → `/profile/ahmed`
- `/?view=series-detail&series=xyz` → `/series/xyz`
- `/?view=team-detail&team=xyz` → `/teams/xyz`
- `/?view=search&q=xxx` → `/search?q=xxx`

#### View Component Updates

- Updated `mod-detail.tsx` — uses `useParams()` for slug
- Updated `game-detail.tsx` — uses `useParams()` for slug
- Updated `profile.tsx` — uses `useParams()` for user
- Updated `platform.tsx` — uses `useParams()` for key
- Updated `series-detail.tsx` — uses `useParams()` for slug, added name fallback matching
- Updated `use-team-detail.ts` hook — uses `useParams()` for slug

#### Link Updates

Updated internal links across 25+ files:
- `navbar.tsx` — platform, series, teams, search, profile, login, settings links
- `footer.tsx` — platform, series, support, problems, about, terms, privacy links
- `mod-card.tsx` — mod detail, profile links
- `game-card.tsx` — platform links
- `hero-slider.tsx` — mod detail links
- `home-sidebar.tsx` — mod detail links
- `home.tsx` — series, platform links
- `mod-detail.tsx` — series, team, platform links
- `team-detail.tsx` — teams list, profile links
- `profile.tsx` — home, settings links
- `settings.tsx` — profile, login links
- `login.tsx` — terms, privacy links
- `coming-soon.tsx` — games, home links
- `explore.tsx` — series, platform links
- `support.tsx` — explore, problems, about links
- `translation-teams.tsx` — team detail links
- `series.tsx` — series detail links
- `news-ticker.tsx` — removed dead `?view=news` fallbacks
- `news-featured.tsx` — removed dead `?view=news` fallbacks
- `notification-dropdown.tsx` — notifications link
- `mod-comments.tsx` — login link
- `admin/games/page.tsx` — platform link

#### Cleanup

- Simplified `src/app/page.tsx` — now a server component rendering only `HomePage` with metadata
- Removed SPA view-switching logic (dynamic imports, KNOWN_VIEWS, transition animations)
- Cleaned up `SeoUpdater` — now only handles GA injection, theme-color, and twitter:site (route-level SEO via `generateMetadata`)
- Fixed Telegram redirect hack in `login.tsx` (`/?t=` cache buster → `/`)

## [0.2.0] - 2026-08-11

### Added

- **Comprehensive documentation** — Created ARCHITECTURE.md and docs/ folder with 10 documentation files
- **API Standardization** — Standardized response format across all API routes
  - `{ data }` for single resources
  - `{ data, pagination }` for paginated lists
  - `{ error: { code, message, details? } }` for errors
- **Response helpers** — `ok()`, `okPaginated()`, `fail()`, `notFound()`, `unauthorized()`, `forbidden()`, `validationFail()`, `rateLimited()`, `conflict()`, `internalError()`
- **Zod validation schemas** — Centralized in `src/lib/schemas.ts`
  - PaginationSchema, SlugParamSchema, UsernameParamSchema
  - LoginSchema, ChangePasswordSchema
  - CreateModSchema, UpdateModSchema
  - UpdateProfileSchema, CreateUserSchema
  - CreateCommentSchema, UpdateCommentSchema
  - BookmarkSchema, CreateReportSchema
  - CreateGameSchema, UpdateGameSchema
  - CreateTeamSchema, UpdateTeamSchema
  - CreateSeriesSchema, UpdateSeriesSchema
  - CreateNewsSchema, UpdateNewsSchema
  - CreateAdSchema, UpdateAdSchema
  - UpdateSettingSchema, BanUserSchema, TierRuleSchema

### Changed

- **API response format** — All endpoints now use standardized response format
- **API error handling** — Consistent error codes and HTTP statuses
- **API documentation** — Complete endpoint listing in API-STANDARDIZATION.md

## [0.1.0] - Initial Architecture

### Core Features

- SPA architecture with `?view=` query param routing
- 24 views with lazy loading via `next/dynamic`
- Prisma ORM with PostgreSQL (Neon)
- Supabase Auth (Google, Discord, Telegram OAuth)
- JWT role cookie for Edge middleware
- Admin panel with role-based access
- IP ban system via Upstash Redis cache
- Mod upload, browse, endorse, download
- User profiles with tier progression
- Translation teams and series
- News ticker and featured news
- Comments with nested replies
- Reports and moderation system
- Notifications system
- Bookmarks

### Tech Stack

- Next.js 16 (App Router, standalone)
- React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui
- Prisma 6, PostgreSQL (Neon)
- Supabase Auth, jose (JWT)
- Zustand, React Query patterns
- Zod 4 validation
- Upstash Redis
- Resend (email)
- Framer Motion, Recharts

## Key Architectural Decisions

### ADR-001: SPA View Switching → File-Based Routing

**Status:** Completed (migrated in v0.3.0)

**Decision:** Migrated from `?view=` query params to Next.js App Router file-based routing.

**Context:** SPA navigation was fast but lacked SEO, meaningful URLs, and proper browser history.

**Consequences:**
- Each page now has unique URLs, metadata, and SEO tags
- Old URLs redirect to new ones (13 static + 5 parametric)
- View components remain in `src/views/` for code organization
- Route pages are thin wrappers in `src/app/` with `generateMetadata`

### ADR-002: Supabase Auth + Neon DB

**Status:** Active

**Decision:** Use Supabase for OAuth flows, store user data in Neon DB.

**Context:** Need OAuth complexity handled (Google, Discord, Telegram) but also need rich relational data.

**Consequences:**
- Two-system auth architecture
- `syncNeonUser()` bridges Supabase and Neon
- More complex than single-system auth
- Better separation of concerns

### ADR-003: JWT Role Cookie

**Status:** Active

**Decision:** Sign a `ga_admin_role` JWT cookie for Edge middleware.

**Context:** Edge middleware can't use Prisma (Node-only).

**Consequences:**
- Fast auth checks in middleware
- No database calls in Edge runtime
- Token versioning for instant session invalidation
- More complex than session-based auth

### ADR-004: IP Ban via Redis Cache

**Status:** Active

**Decision:** Cache IP bans in Upstash Redis for Edge-compatible checks.

**Context:** Middleware runs in Edge and can't query the database.

**Consequences:**
- Fast IP ban checks in middleware
- Full ban verification server-side
- Cache layer adds complexity
- Fail-open if Redis is unavailable

### ADR-005: Centralized Zod Schemas

**Status:** Active

**Decision:** All validation schemas in `src/lib/schemas.ts`.

**Context:** Need consistent validation across all API endpoints.

**Consequences:**
- Single source of truth for validation
- Consistent error responses
- Easy to maintain and update
- May become large file over time

### ADR-006: Standardized API Responses

**Status:** Active

**Decision:** All API routes return `{ data }`, `{ data, pagination }`, or `{ error: { code, message } }`.

**Context:** Need consistent contract between backend and frontend.

**Consequences:**
- Predictable response shapes
- Easy to consume in frontend
- Consistent error handling
- Migration effort for existing endpoints
