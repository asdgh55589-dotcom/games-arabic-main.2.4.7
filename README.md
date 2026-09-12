# Games Arabic

![Status](https://img.shields.io/badge/Status-Production%20Ready%20✅-brightgreen) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)

Arabic game localization platform — file-based routing (Next.js 16 App Router), Prisma 6 + Neon PostgreSQL, Supabase Auth (Google/Discord/Telegram), Tailwind CSS 4 + shadcn/ui. Includes 147 API handlers, 26 views, 53 Prisma models, and a Clean Architecture notification system.

**Project Status: Production Ready ✅** — All 10 phases complete (visual, workflow, analytics, security, auth UX, performance). See [docs/AUTH-SYSTEM.md](./docs/AUTH-SYSTEM.md) for auth details.

## Key Features

- **Workflow Engine** — DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED with audit history
- **Versioning** — Full mod version history with rollback and `createMany`-optimized transactions
- **Bulk Actions** — Admin bulk mod operations and user management
- **Telegram Automation** — Deep Link login, channel posts, scheduled jobs, exports/backups
- **Analytics** — 8 chart types for downloads, endorsements, team quality, and more
- **Support System** — Tickets, rewards, advanced search, audit log
- **Security Hardened** — JWT `ga_admin_role` + `tokenVersion` cache, rate limiting, IP bans, CSP
- **Dynamic Sections** — Homepage `modsByPlatform` built from `Section` table (not hardcoded)

## Quick Start

```bash
# 1. Install
bun install

# 2. Env — copy template and fill values
cp .env.example .env
# Required: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#           SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, OWNER_USERNAME/EMAIL/PASSWORD
# Optional: TELEGRAM_BOT_TOKEN/CHANNEL_ID, EMITLO_API_KEY, UPSTASH_REDIS, YT_DLP_PATH
# See .env.example for full list with comments.

# 3. DB
bun run db:push       # push schema (dev) — syncs indexes for Team/Series/HomepageAd
bun run db:generate   # generate Prisma client (also runs via `prisma generate`)
# or: bun run db:migrate  # create migration (production)

# 4. Dev server
bun run dev           # http://localhost:3000 (webpack, port 3000)
```

## Notification System

The platform includes a comprehensive notification system supporting 20 notification types across InApp and Email channels.

### Key Features
- **Clean Architecture** — Domain, Application, and Infrastructure layers
- **20 Use Cases** — From comment replies to system announcements
- **Resilience** — Circuit breaker, exponential backoff retry, dead letter queue
- **Preferences** — Per-user quiet hours, per-type channel overrides
- **Deduplication** — Configurable time windows per notification type
- **Templates** — Handlebars-based with admin UI for CRUD and preview
- **Observability** — Structured logging, metrics, health dashboard

### Architecture Docs
- [Architecture Overview](docs/NOTIFICATION_ARCHITECTURE.md)
- [Notification Types Reference](docs/NOTIFICATION_TYPES.md)

### Developer Quick Start

```typescript
import { getUseCases } from '@/application/use-cases/factory'

const useCases = getUseCases()

// Send a comment reply notification
await useCases.sendCommentReply.execute({
  commentOwnerId: 'user-1',
  replierId: 'user-2',
  replierName: 'Ahmad',
  modId: 'mod-1',
  modTitle: 'Game Title',
  modSlug: 'game-title',
  commentId: 'comment-1',
  replyPreview: 'Great work!',
})
```

### Environment Variables

Required for email notifications:
- `EMITLO_API_KEY` — Emitlo API key

### Admin Dashboard
- Templates: `/admin/templates`
- Health: `/admin/notifications-health`

## Tech Stack

- Next.js 16 (App Router, standalone output, file-based routing)
- React 19, TypeScript 5
- Tailwind CSS 4 with shadcn/ui (40+ primitives)
- Prisma 6 + PostgreSQL (Neon, 53 models)
- Supabase Auth (Google, Discord, Telegram Deep Link)
- Zustand + `useFetch` + React Query for data fetching
- Upstash Redis (IP ban cache + tokenVersion cache + rate limiting)
- Emitlo (email), yt-dlp (YouTube metadata)

## Commands

```bash
bun run dev          # Dev server on :3000 (webpack)
bun run build        # prisma generate → prisma migrate deploy → next build → copy to .next/standalone
bun run lint         # eslint (permissive)
npx jest             # Jest with ts-jest (src/__tests__/)
bun run db:push      # prisma db push (dev, uses src/lib/home-cache indexes)
bun run db:generate  # prisma generate
bun run db:migrate   # prisma migrate dev --name <change>
bun run db:reset     # prisma migrate reset
npx tsx scripts/seed.ts        # seed DB
npx tsx prisma/seed-notification-templates.ts  # seed notification templates
```

## Deployment Guide

### Vercel (recommended)
1. Push to GitHub → Import in Vercel → set env vars from `.env.example`
2. Set `DATABASE_URL` (pooled) + `JWT_SECRET` + `SUPABASE_*` + `OWNER_*`
3. `Build Command: bun run build` (runs `prisma generate` + `migrate deploy` + `next build`)
4. `Output: .next/standalone` (already configured via `output: 'standalone'`)

### Node Standalone (Docker/VM)
```bash
bun run build
node .next/standalone/server.js # or `bun .next/standalone/server.js`
# Ensure DATABASE_URL, JWT_SECRET, etc. are set in production env
# Run `npx prisma migrate deploy` before first start if not in build script
```

### JWT_SECRET Rotation
See [docs/AUTH-SYSTEM.md#jwt-secret-rotation](./docs/AUTH-SYSTEM.md#jwt-secret-rotation) — update both `.env` and `.env.local`, restart, old cookies auto-clear on next `/api/auth/me` call.

## Architecture Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — High-level architecture & folder structure
- [TECHNICAL.md](./TECHNICAL.md) — Comprehensive technical docs (147 API handlers, 40+ models)
- [docs/ROUTING-ARCHITECTURE.md](./docs/ROUTING-ARCHITECTURE.md) — File-based routing + 301 redirects + metadata
- [docs/DATABASE.md](./docs/DATABASE.md) — Prisma schema (53 models)
- [docs/AUTH-SYSTEM.md](./docs/AUTH-SYSTEM.md) — Supabase + JWT `ga_admin_role` + `tokenVersion` cache
- [AGENTS.md](./AGENTS.md) — Agent instructions (routing, middleware, gotchas)
