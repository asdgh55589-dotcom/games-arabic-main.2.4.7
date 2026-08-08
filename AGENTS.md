# AGENTS.md

## Tech Stack
- Next.js 16 (App Router, standalone output)
- React 19, TypeScript 5
- Tailwind CSS 4 with shadcn/ui components
- Prisma 6 + PostgreSQL (Neon)
- Supabase Auth (OAuth: Google, Discord, Telegram)
- Zustand for state, React Query for data fetching

## Commands
- `bun run dev` — dev server on :3000
- `bun run build` — prisma generate → migrate deploy → next build → copy standalone
- `bun run lint` — eslint (very permissive config)
- `bun run db:push` — push schema changes
- `bun run db:migrate` — create migration
- `bun run db:reset` — reset database
- `npx tsx scripts/seed.ts` — seed database

## Architecture

### Routing Pattern
Views are in `src/views/` and rendered by `src/app/page.tsx` based on query param `?view=<name>`. Not file-based routing for pages — the main page switches views dynamically.

### API Routes
All under `src/app/api/` — standard Next.js Route Handlers. Admin routes require moderator+ role.

### Authentication
- **Supabase Auth** for OAuth login flows
- **JWT role cookie** (`ga_admin_role`) for admin route protection in middleware (Edge runtime)
- **Roles**: owner > admin > moderator > member
- Middleware cannot use Prisma — uses jose for JWT verification only

### Database
- Prisma schema at `prisma/schema.prisma`
- Key models: User, Game, Mod, ModFile, Series, Team, Notification, Report
- Connection pool configured for serverless (5 connections, 30s timeout)

### Middleware
- `src/middleware.ts` runs in Edge runtime
- Protects `/admin/*` and `/api/admin/*` routes
- Refreshes Supabase session for all routes
- IP ban checking for sensitive API paths (auth, comments, mods)

## Gotchas

### Edge Runtime Constraint
Middleware runs in Edge — cannot import Prisma, Node-only modules, or anything that uses `fs`. Use `jose` for JWT, `@/lib/ip-ban-cache` for Redis-based IP checks.

### Build Process
The `build` script runs: `prisma generate → prisma migrate deploy → next build → copy .next/static + public to standalone`. The standalone output is at `.next/standalone/`.

### ESLint Config
Very permissive — `no-explicit-any: off`, `no-unused-vars: off`, `react-hooks/exhaustive-deps: off`. Don't rely on lint to catch issues.

### TypeScript Config
- Path alias: `@/*` → `./src/*`
- `noImplicitAny: false` — explicit any is allowed
- `strict: true` but with `noImplicitAny: false`

### RTL Layout
The app is Arabic-first with `dir="rtl"` on `<html>`. All UI should be designed for right-to-left flow.

### View Switching
The main page uses `?view=<name>` query param to switch between views. Views are in `src/views/`. To add a new page, create a view component and register it in `src/app/page.tsx`.

## Testing
- Jest with ts-jest preset
- Tests in `src/__tests__/`
- Run: `npx jest`

## Database Operations
- Schema changes: `npx prisma db push` (dev) or `npx prisma migrate dev` (create migration)
- After schema changes: `npx prisma generate`
- Seed: `npx tsx scripts/seed.ts`
