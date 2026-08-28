# AGENTS.md

## Tech Stack
- Next.js 16 (App Router, standalone output)
- React 19, TypeScript 5
- Tailwind CSS 4 with shadcn/ui components (40+ primitives)
- Prisma 6 + PostgreSQL (Neon, 53 models)
- Supabase Auth (OAuth: Google, Discord, Telegram Deep Link)
- Zustand + `useFetch` + React Query for data fetching
- Upstash Redis (IP ban cache + tokenVersion cache + rate limiting)

## Commands
- `bun run dev` — dev server on :3000 (webpack)
- `bun run build` — `prisma generate → prisma migrate deploy → next build → copy to .next/standalone`
- `bun run lint` — eslint (very permissive config)
- `bun run db:push` — push schema changes (dev)
- `bun run db:generate` — `prisma generate`
- `bun run db:migrate` — create migration (`prisma migrate dev --name <change>`)
- `bun run db:reset` — `prisma migrate reset`
- `npx tsx scripts/seed.ts` — seed database
- `npx tsx prisma/seed-notification-templates.ts` — seed notification templates
- `npx jest` — run tests (Jest with ts-jest, tests in `src/__tests__/`)

## Architecture

### Routing Pattern
File-based routing via Next.js App Router. Each route has `src/app/<route>/page.tsx` that imports a view from `src/views/` and exports `generateMetadata` for SEO. Dynamic routes use `useParams()` (e.g. `/mod/[slug]`, `/games/[slug]`, `/profile/[user]`, `/platform/[key]`). Legacy `?view=` URLs are 301-redirected via `next.config.ts` (static pages) and middleware (parametric pages).

### API Routes
All under `src/app/api/` — standard Next.js Route Handlers (147 handlers). Admin routes require moderator+ role (moderator | manager | admin | owner).

### Authentication
- **Supabase Auth** for OAuth login flows (+ Telegram Deep Link)
- **JWT role cookie** (`ga_admin_role`) for admin route protection in middleware (Edge runtime)
- **Roles**: owner > manager > admin > moderator > publisher > member (hierarchy; `requireAdmin()` accepts manager/admin/owner)
- Middleware cannot use Prisma — uses `jose` for JWT + Redis (`ip-ban-cache`, `token-version-cache`) for Edge-safe checks. `tokenVersion` is validated against Redis with 1s timeout (fail-open).

### Database
- Prisma schema at `prisma/schema.prisma` (53 models)
- Key models: User, Game, Mod, ModFile, Series, Team, Notification, Report, Ticket, Section, Achievement
- Connection pool configured for serverless (5 connections, 30s timeout)
- Models include OAuthAccount, WorkflowEntry, ModVersion, DownloadClick, ScheduledJob, NotificationJob, IpBan, UserTrustScore, TierRule, SpecialRole, News, HomepageAd, AuditLog

### Middleware
- `src/lib/supabase/middleware.ts` runs in Edge runtime (wraps Supabase session refresh)
- Admin protection via `ga_admin_role` JWT cookie (no Supabase DB call)
- Refreshes Supabase session for all routes (8s timeout, fail-open)
- IP ban checking ONLY for write/sensitive paths: `POST /api/auth`, `POST /api/comments`, `POST /api/mods`, `POST /api/admin/users` (GET excluded)
- SPA `?view=` → file-route 301 redirects for `platform/profile/series-detail/team-detail/search`
- Adds security headers: HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options, etc.

### Notification System (Clean Architecture)
- Domain layer: `src/domain/` (entities, value objects, ports, policies, events)
- Application layer: `src/application/use-cases/` (20+ use cases)
- Infrastructure layer: `src/infrastructure/` (Prisma repos, Resend email, circuit breaker, retry policy, dead letter handler)
- Templates: Handlebars-based, seeded via `prisma/seed-notification-templates.ts`
- Admin UI: `/admin/templates` (CRUD + preview), `/admin/notifications-health` (observability)

## Gotchas

### Edge Runtime Constraint
Middleware runs in Edge — cannot import Prisma, Node-only modules, or anything that uses `fs`. Use `jose` for JWT, `@/lib/ip-ban-cache` + `@/lib/token-version-cache` for Redis-based IP/token checks (both fail-open with timeouts).

### Build Process
The `build` script runs: `prisma generate → prisma migrate deploy → next build → copy .next/static + public to standalone`. The standalone output is at `.next/standalone/`. Standalone mode is set via `output: 'standalone'` in `next.config.ts`.

### ESLint Config
Very permissive — `no-explicit-any: off`, `no-unused-vars: off`, `react-hooks/exhaustive-deps: off`. Don't rely on lint to catch issues.

### TypeScript Config
- Path alias: `@/*` → `./src/*`
- `noImplicitAny: false` — explicit any is allowed
- `strict: true` but with `noImplicitAny: false`
- Excludes `gentelella-master` (separate project)

### RTL Layout
The app is Arabic-first with `dir="rtl"` on `<html>`. All UI should be designed for right-to-left flow.

### View Switching
The app uses **Next.js App Router file-based routing** (migrated from legacy SPA `?view=`). Each page has a route file in `src/app/<route>/page.tsx` that imports a view component from `src/views/`. Dynamic routes use `useParams()` for path segments. Each route page exports `generateMetadata` for SEO. Shared layout (Navbar + Footer) wraps all pages via `AppShell` in `src/app/layout.tsx`. Legacy `?view=` URLs are 301-redirected via `next.config.ts` (static pages) and middleware (parametric pages).

### genshin Subfolder
`gentelella-master/` is a separate dashboard template project (not part of the main app). Ignore it for this project.

## Database Operations
- Schema changes: `npx prisma db push` (dev) or `npx prisma migrate dev --name <change>` (create migration)
- After schema changes: `npx prisma generate`
- Seed: `npx tsx scripts/seed.ts` (main) + `npx tsx prisma/seed-notification-templates.ts` (templates)

## Critical Rule — Do NOT Touch What You Weren't Asked To

**NEVER change anything the user didn't explicitly ask you to change.** If the user says "change X", you change ONLY X — nothing more, nothing less. Don't assume, don't "improve" adjacent things, don't "fix" related things. Only do exactly what was requested. If you're unsure, ask before acting.