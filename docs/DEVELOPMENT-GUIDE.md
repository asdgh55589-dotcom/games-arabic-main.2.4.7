# Development Guide

> **Last Updated:** 2026-08-20

## Prerequisites

- **Node.js** 18+ (or Bun)
- **Bun** (recommended) or npm/yarn
- **PostgreSQL** (Neon account or local)

## Local Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd games-arabic-main
bun install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Required variables in `.env.local`:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# JWT
JWT_SECRET="generate-with: openssl rand -base64 32"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# OAuth (configure in Supabase Dashboard)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""

# Telegram
TELEGRAM_BOT_TOKEN=""
TELEGRAM_BOT_NAME=""

# Email (Emitlo)
EMITLO_API_KEY="em_your_api_key"
EMAIL_FROM="noreply@games-arabic.com"

# Site
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

### 3. Database Setup

```bash
# Push schema to database
bun run db:push

# Generate Prisma client
bun run db:generate

# Seed with sample data (optional)
npx tsx scripts/seed.ts
```

### 4. Start Dev Server

```bash
bun run dev
```

Server runs at `http://localhost:3000`.

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on :3000 |
| `bun run build` | Production build (prisma generate → migrate → next build) |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:migrate` | Create a new migration |
| `bun run db:reset` | Reset database (drops all data) |
| `npx tsx scripts/seed.ts` | Seed database with sample data |
| `npx jest` | Run tests |

## Build Process

The `build` script runs:

1. `prisma generate` — Generate Prisma client
2. `prisma migrate deploy` — Apply pending migrations
3. `next build` — Build Next.js (standalone output)
4. `cp -r .next/static .next/standalone/.next/` — Copy static assets
5. `cp -r public .next/standalone/` — Copy public assets

Standalone output: `.next/standalone/`

## Project Structure (file-based routing, 26 views, 147 API handlers)

```
src/
├ app/                    # Next.js App Router (file-based)
│   ├── page.tsx          # Home page (HomePage + generateMetadata)
│   ├── layout.tsx        # Root layout (AppShell + Suspense, dir="rtl")
│   ├── globals.css       # Global styles (oklch theme, gradients, RTL)
│   ├── mod/[slug]/       # Mod detail (useParams slug)
│   ├── games/            # Game routes (list + [slug])
│   ├── series/           # Series routes (list + [slug])
│   ├── teams/            # Teams routes (list + [slug])
│   ├── profile/[user]/   # User profile (useParams user)
│   ├── platform/[key]/   # Platform page (useParams key)
│   ├── search/           # Search (?q= query)
│   ├── favorites/        # Favorites (bookmarks)
│   ├── upload/           # Upload mod
│   ├── login/            # Login (OAuth + Telegram)
│   ├── notifications/    # Notifications
│   ├── settings/         # Settings
│   ├── about/            # About (static)
│   ├── support/          # Support
│   ├── explore/          # Explore
│   ├── community/        # Community
│   ├── problems/         # Problems
│   ├── terms/            # Terms (noindex)
│   ├── privacy/          # Privacy (noindex)
│   ├── api/              # API route handlers (147 handlers)
│   └── admin/            # Admin panel (22+ sections, SSR, role-gated)
├ views/                  # View components (26 files, 'use client', useParams/useFetch)
├ components/             # Shared React components
│   ├── ui/               # shadcn/ui primitives (40+)
│   ├── layout/           # AppShell, Navbar, Footer, ErrorBoundary
│   └── ...
├ hooks/                  # Custom React hooks (use-fetch, use-team-detail…)
├ contexts/               # AuthContext, SettingsContext, BookmarksContext
├ lib/                    # Utilities and services (35+ files)
│   ├── api-response.ts   # ok(), okPaginated(), fail() helpers
│   ├── api-client.ts     # Client fetch wrapper (ApiError)
│   ├── auth.ts           # Auth helpers (requireAuth, tokenVersion)
│   ├── db.ts             # Prisma client singleton (5 conn, 30s)
│   ├── schemas.ts        # Zod schemas (centralized)
│   ├── ip-ban-cache.ts   # Redis IP ban (Edge-safe)
│   ├── token-version-cache.ts # Redis tokenVersion (Edge-safe)
│   ├── rate-limit.ts     # Rate limiting
│   └── types.ts          # TypeScript types
└ middleware.ts           # Edge middleware (JWT + tv cache + IP ban + ?view= redirects + CSP/HSTS)
```

## Adding a New Feature

### 1. API Endpoint

Create `src/app/api/your-feature/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, okPaginated, fail } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { parsePagination, serialize } from '@/lib/api-utils'
import { YourSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const { page, limit } = parsePagination(
    searchParams.get('page'),
    searchParams.get('limit')
  )

  const [total, items] = await Promise.all([
    db.yourModel.count(),
    db.yourModel.findMany({ skip: (page - 1) * limit, take: limit }),
  ])

  return okPaginated(serialize(items), {
    page, limit, total,
    totalPages: Math.ceil(total / limit) || 1,
  })
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = YourSchema.safeParse(body)

    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Invalid input', 422, parsed.error.flatten())
    }

    const item = await db.yourModel.create({ data: parsed.data })
    return ok(serialize(item), { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) {
      return fail('UNAUTHORIZED', e.message, e.status)
    }
    return fail('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
```

### 2. Zod Schema

Add to `src/lib/schemas.ts`:

```typescript
export const YourSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})
```

### 3. TypeScript Types

Add to `src/lib/types.ts`:

```typescript
export interface YourType {
  id: string
  name: string
  description: string | null
}
```

### 4. View Component

Create `src/views/your-feature.tsx`:

```typescript
'use client'

import { useFetch } from '@/hooks/use-fetch'

export function YourFeaturePage() {
  const { data, loading, error } = useFetch('/api/your-feature')

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  const items = data?.data ?? []

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

### 5. Create Route Page

#### Static route (no params):

Create `src/app/your-feature/page.tsx`:

```typescript
import type { Metadata } from 'next'
import { YourFeaturePage } from '@/views/your-feature'

export const metadata: Metadata = {
  title: 'Your Feature — GAMES ARABIC',
  description: 'Description for SEO',
  openGraph: {
    title: 'Your Feature — GAMES ARABIC',
    description: 'Description for SEO',
    type: 'website',
    siteName: 'GAMES ARABIC',
  },
}

export default function YourFeatureRoutePage() {
  return <YourFeaturePage />
}
```

#### Dynamic route (with params):

Create `src/app/your-feature/[slug]/page.tsx`:

```typescript
import type { Metadata } from 'next'
import { YourFeaturePage } from '@/views/your-feature'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/your-feature/${slug}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return { title: 'Not Found — GAMES ARABIC' }
    const { data } = await res.json()

    return {
      title: `${data.name} — GAMES ARABIC`,
      description: data.description?.slice(0, 160),
      openGraph: {
        title: `${data.name} — GAMES ARABIC`,
        description: data.description?.slice(0, 160),
        images: [{ url: data.imageUrl, width: 1200, height: 630 }],
      },
    }
  } catch {
    return { title: 'Your Feature — GAMES ARABIC' }
  }
}

export default function YourFeatureRoutePage() {
  return <YourFeaturePage />
}
```

Then update the view to use `useParams()`:

```typescript
'use client'
import { useParams } from 'next/navigation'

export function YourFeaturePage() {
  const params = useParams()
  const slug = params.slug as string
  // ...
}
```

### 6. Add Redirect (if replacing old ?view= URL)

For simple redirects, add to `next.config.ts`:

```typescript
{ source: '/:path*', destination: '/your-feature', permanent: true,
  has: [{ type: 'query', key: 'view', value: 'your-feature' }] },
```

For parametric redirects (query param → path segment), add to `src/middleware.ts`:

```typescript
case 'your-view': {
  const param = req.nextUrl.searchParams.get('param')
  if (param) destination = `/your-feature/${encodeURIComponent(param)}`
  break
}
```

## Adding a New API Endpoint

1. Create route file in `src/app/api/<path>/route.ts`
2. Add Zod schema in `src/lib/schemas.ts` (if validating input)
3. Add types in `src/lib/types.ts` (if needed)
4. Use `requireAuth()` / `requireAdmin()` for protected routes
5. Use `ok()` / `okPaginated()` / `fail()` for responses
6. Use `serialize()` to convert Prisma Date objects to strings

## Common Issues

### Prisma Client Not Generated

```bash
bun run db:generate
```

### Database Connection Error

Check `DATABASE_URL` in `.env.local`. Ensure `sslmode=require` is present.

### Supabase Auth Not Working

1. Check redirect URLs in Supabase Dashboard
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
3. Check OAuth provider configuration in Supabase Dashboard

### Middleware Not Running

The middleware matcher in `src/middleware.ts` covers:
- `/admin/:path*`
- `/api/admin/:path*`
- All routes except static files

### Build Fails

```bash
# Clean and rebuild
rm -rf .next
bun run build
```

### Edge Runtime Errors

Middleware runs in Edge runtime. You CANNOT:
- Import Prisma
- Use `fs`, `path`, or Node built-ins
- Make database queries directly

Use `jose` for JWT and Redis for caching.

## Testing

```bash
npx jest
```

Tests are in `src/__tests__/`. Uses Jest with ts-jest preset.

## Linting

```bash
bun run lint
```

ESLint config is very permissive:
- `no-explicit-any: off`
- `no-unused-vars: off`
- `react-hooks/exhaustive-deps: off`

Don't rely on lint to catch issues — use TypeScript and code review.

## TypeScript

```bash
npx tsc --noEmit
```

Key config:
- Strict mode enabled
- `noImplicitAny: false` (explicit any allowed)
- Path alias: `@/*` → `./src/*`
