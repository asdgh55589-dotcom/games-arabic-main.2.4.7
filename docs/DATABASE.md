# Database Documentation

> **Last Updated:** 2026-08-20

## Overview

- **Database:** PostgreSQL hosted on Aiven (primary) / Neon (legacy fallback)
- **ORM:** Prisma 6
- **Schema:** `prisma/schema.prisma` (53 models, 40+ indexes)
- **Connection:** 5 connections, 30s timeout (serverless-optimized, singleton via `globalThis` in dev)
- **SSL:** `sslmode=require` enforced (Aiven requirement)

## Connection Setup

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error', 'warn'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

The singleton pattern prevents multiple Prisma clients in development (hot reload).

## Connection Setup — Aiven (Primary)

`src/lib/db.ts` resolves the active connection URL with dual-URL support:

1. **`AIVEN_DATABASE_URL`** — preferred when set (cutover day variable)
2. **`DATABASE_URL`** — fallback (Neon or Aiven, same shape)

```typescript
// src/lib/db.ts — getDatabaseUrl() helper
export function getDatabaseUrl(): string {
  const aiven = process.env.AIVEN_DATABASE_URL
  const fallback = process.env.DATABASE_URL
  const raw = aiven && aiven.trim() !== '' ? aiven : fallback
  if (!raw || raw.trim() === '') {
    throw new Error('DATABASE_URL must be set (or AIVEN_DATABASE_URL for Aiven)')
  }
  return raw
}
```

`ensureSslmode(url)` enforces `sslmode=require` and injects pool-tuning defaults if missing:

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `sslmode` | `require` | TLS to Aiven (throws if `disable`/`allow`/non-require) |
| `connect_timeout` | `10` | Seconds to wait for connection |
| `connection_limit` | `5` | Prisma connection pool size |
| `pool_timeout` | `10` | Seconds before pool exhaustion error |

`withRetry(fn)` provides exponential backoff (1s, 2s, 4s, max 3 attempts) for Aiven cold-start resilience.

### Cutover Pattern

Set `AIVEN_DATABASE_URL` on deploy day; unset to revert to `DATABASE_URL`. No code change needed — runtime switch only.

```env
# .env (cutover day)
AIVEN_DATABASE_URL="postgresql://avnadmin:xxx@host:5432/games_arabic?sslmode=require&connection_limit=5&pool_timeout=10&connect_timeout=10"
DATABASE_URL="postgresql://..."  # kept as fallback
```

## Key Models

### User

User accounts with roles, ban system, tier progression, and social links.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `supabaseId` | String? | Supabase Auth user ID (unique) |
| `username` | String | Unique username |
| `email` | String | Unique email |
| `role` | String | `member` \| `publisher` \| `moderator` \| `manager` \| `admin` \| `owner` (hierarchy) |
| `banStatus` | String | `active` \| `banned_temp` \| `banned_perm` \| `restricted` |
| `bannedUntil` | DateTime? | Ban expiration |
| `tokenVersion` | Int | For instant session invalidation (checked in Edge via Redis) |
| `tier` | Int | 0-5 progression tier |
| `specialRoles` | String | CSV of special role keys |
| `telegramUrl` | String? | Telegram link |
| `accentColor` | String? | Profile accent color (`#ff8c00`) |

**Relations:** mods (authored) + reviewer, endorsements, comments, notifications (user/actor), bookmarks, follows, teamMemberships, oauthAccounts, tickets, ratings, savedSearches, etc.

### Game

Video games that mods are for.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `slug` | String | URL slug (unique) |
| `name` | String | Game name |
| `category` | String | RPG, FPS, Strategy, etc. |
| `platform` | String | PC, NS, PS1-PS4, X360 |
| `releaseYear` | Int | Release year |
| `modCount` | Int | Cached mod count |
| `totalDownloads` | Int | Cached download count |

**Relations:** mods, categories

### Mod

Translation mods — the core entity with workflow, versioning, and quality.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `slug` | String | URL slug (unique) |
| `name` | String | Mod name |
| `summary` | String | Short description |
| `description` | String | Full description (markdown) |
| `authorId` | String | FK to User |
| `gameId` | String | FK to Game |
| `categoryId` | String? | FK to Category |
| `sectionId` | String? | FK to Section (dynamic platform sections) |
| `translationType` | String | `official` \| `unofficial` |
| `translationScope` | String | Scope of translation |
| `workflowStatus` | String | `DRAFT` \| `IN_REVIEW` \| `APPROVED` \| `PUBLISHED` \| `ARCHIVED` \| `REJECTED` |
| `scheduledAt` | DateTime? | Scheduled publish time |
| `qualityScore` | Float | Computed quality (0-100) |
| `downloads` / `endorsements` / `views` | Int | Counters |
| `rating` | Float | Average rating |

**Relations:** author, reviewer, game, category, section, seriesRelation, teamRelation, files, videoGroups, teamMembers, contactLinks, customTabs, commentsRecords, endorsementRecords, bookmarks, reports, ratings, versionHistory, workflowHistory, scheduledJobs, downloadClicks

### ModFile

Download files for mods (multiple per mod).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `modId` | String | FK to Mod |
| `title` | String | File title |
| `version` | String | File version |
| `fileSize` | String | Human-readable size |
| `fileFormat` | String | 7z, zip, rar |
| `order` | Int | Display order |

**Relations:** links (ModFileLink)

### Series

Game series grouping (e.g., "God of War" series).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `slug` | String | URL slug (unique) |
| `name` | String | Series name |
| `isFeatured` | Boolean | Featured on homepage |
| `isOfficial` | Boolean | Official series |
| `modCount` | Int | Cached mod count |

**Relations:** mods

### Team

Translation teams.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `slug` | String | URL slug (unique) |
| `name` | String | Team name |
| `ownerId` | String? | Team leader |
| `isOfficial` | Boolean | Official team |
| `isFeatured` | Boolean | Featured on homepage |

**Relations:** mods, memberships, contactLinks, customTabs, follows

### ModComment

Comments on mods (supports nested replies).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `modId` | String | FK to Mod |
| `userId` | String? | FK to User (null for guests) |
| `parentId` | String? | FK to parent comment (for replies) |
| `text` | String | Comment text |
| `likes` | Int | Like count |
| `dislikes` | Int | Dislike count |
| `isPinned` | Boolean | Pinned by admin |

**Relations:** user, parent, replies, reports, commentLikes

### Notification (Clean Architecture)

User notifications with jobs, preferences, and templates.

| Field | Type | Description |
|-------|------|-------------|
| `id` / `userId` / `actorId` | String | PK + FKs |
| `type` / `title` / `message` | String | Type + content (20 types) |
| `data` | Json? | Type-specific payload |
| `isRead` | Boolean | Read status |

**Relations:** user, actor, logs (`NotificationLog`), jobs (`NotificationJob`)

**Related:** `NotificationPreference` (per-user quiet hours + `typePreferences` JSON), `NotificationJob` (delivery queue with `scheduledFor`, `attempts`, `dead_letter`), `NotificationTemplate` (Handlebars `titleTemplate`/`bodyTemplate` per `type`+`channel`, unique), `NotificationLog` (channel delivery log)

### Report + Fraud Detection

Content reports with automated fraud scoring.

| Field | Type | Description |
|-------|------|-------------|
| `reporterId` / `targetType` / `targetModId` etc. | String | Reporter + target (mod/comment/user) |
| `reason` / `priority` / `status` | String | `spam`/`inappropriate`/… + `new`/`in_progress`/… |
| `fraudScore` / `repeatOffenseLevel` | Float/Int | 0.0-1.0 + 0-3 |

**Relations:** reporter, targetMod, targetComment, targetUser, assignedTo, fraudSignals (`ReportFraudSignal`), statusHistory (`ReportStatusHistory`)

### Other Models (53 total — key remaining)

| Model | Purpose |
|-------|---------|
| `OAuthAccount` | Supabase/Telegram OAuth links (unique `provider`+`providerAccountId`) |
| `Category` | Game categories (FK to Game, unique `gameId`+`slug`) |
| `Endorsement` | Mod endorsements (unique `userId`+`modId`, `up`/`down`) |
| `ModFileLink` | Download mirror links per file |
| `ModVideoGroup` / `ModVideo` | Video groups + individual videos |
| `ModTeamMember` | Per-mod team members |
| `ModContactLink` | Per-mod contact links |
| `ModCustomTab` | Custom tabs per mod (unique `modId`+`slug`) |
| `ModVersion` | Mod version history (changelog + files) |
| `WorkflowEntry` | Workflow status changes (`DRAFT`→`PUBLISHED` etc.) |
| `ModRating` | 1-5 star ratings (unique `modId`+`userId`) |
| `DownloadClick` | Download click tracking (ip, userAgent) |
| `ScheduledJob` | Scheduled tasks (`telegram_post`, `backup`…) |
| `Follow` | User follows (unique `followerId`+`followingId`) |
| `Bookmark` | User mod bookmarks (unique `userId`+`modId`) |
| `CommentLike` | Comment likes (unique `userId`+`commentId`) |
| `Section` | Dynamic platform sections (key `PC`, `PS4`…) |
| `Team` / `TeamFollow` / `TeamMembership` | Teams + follows + memberships |
| `TeamContactLink` / `TeamCustomTab` | Team links + custom tabs |
| `TeamAchievement` / `Achievement` / `TeamPoints` / `PointsTransaction` | Gamification for teams |
| `UserAction` | Audit log for user actions (ban/promote…) |
| `TierRule` / `TierHistory` / `SpecialRole` | Tier progression + history + special roles |
| `News` / `HomepageAd` / `SiteSetting` / `AuditLog` | Content + system |
| `IpBan` | IP bans (checked via Redis `ip-ban-cache`, 1-week TTL) |
| `UserTrustScore` / `ReportFraudSignal` / `ReportStatusHistory` | Trust/fraud system |
| `Ticket` / `TicketMessage` / `TicketTag` | Support tickets |
| `SavedSearch` | Saved user searches (query + filters JSON) |

## Relationships Diagram (Simplified — 53 models)

```
User ──┬── Mod (authored) + Mod (reviewer)
       ├── OAuthAccount
       ├── Endorsement / Bookmark / CommentLike / Follow
       ├── ModComment / ModRating
       ├── TeamMembership / TeamFollow / TeamCustomTab*
       ├── Notification (user/actor) + Preference + TrustScore
       ├── Report (filed/target/assigned) + StatusHistory
       ├── Ticket (owned/assigned) + TicketMessage
       ├── TierHistory / UserAction (target/actor) / WorkflowEntry
       ├── ModVersion (created) / SavedSearch

Game ──┬── Mod
       └── Category

Mod ───┬── ModFile ─── ModFileLink
       ├── ModVideoGroup ─── ModVideo
       ├── ModTeamMember / ModContactLink / ModCustomTab
       ├── ModComment / Endorsement / Bookmark / Report / ModRating
       ├── ModVersion / WorkflowEntry / ScheduledJob / DownloadClick
       └── Section / Series / Team / Category / Game

Team ──┬── Mod
       ├── TeamMembership / TeamFollow / TeamContactLink / TeamCustomTab
       ├── TeamAchievement → Achievement / TeamPoints / PointsTransaction

Notification ──┬── NotificationJob (queue) / NotificationLog (delivery)
               └── NotificationTemplate (type+channel, Handlebars)

Report ──┬── ReportFraudSignal / ReportStatusHistory
Section ── Mod (platform grouping)
```

## Common Queries

### List Mods with Pagination

```typescript
const [total, mods] = await Promise.all([
  db.mod.count({ where }),
  db.mod.findMany({
    where,
    orderBy: { downloads: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      author: true,
      game: { select: { name: true, slug: true, platform: true } },
      category: { select: { name: true, slug: true } },
    },
  }),
])
```

### Get Mod Detail with Relations

```typescript
const mod = await db.mod.findUnique({
  where: { slug },
  include: {
    author: true,
    game: true,
    category: true,
    files: { include: { links: true }, orderBy: { order: 'asc' } },
    videoGroups: { include: { videos: true }, orderBy: { order: 'asc' } },
    teamMembers: { orderBy: { order: 'asc' } },
    contactLinks: { orderBy: { order: 'asc' } },
    customTabs: { where: { visible: true }, orderBy: { order: 'asc' } },
  },
})
```

## Running Migrations

### Push Schema Changes (Development)

```bash
bun run db:push
```

### Create Migration

```bash
bun run db:migrate
```

This opens an interactive prompt to name the migration.

### Reset Database

```bash
bun run db:reset
```

**Warning:** This drops all data.

### Generate Prisma Client

```bash
bun run db:generate
```

Always run after schema changes.

### Seed Database

```bash
npx tsx scripts/seed.ts
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require&connection_limit=5&pool_timeout=10"
# Optional: Aiven cutover override (preferred when set)
AIVEN_DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require&connection_limit=5&pool_timeout=10&connect_timeout=10"
```

The `sslmode=require` is required for both Aiven and Neon connections.

## Performance Considerations

- **Connection pooling:** 5 connections, 30s timeout (configured for serverless; pool-tuned for Aiven)
- **Aiven cold-start resilience:** `withRetry()` exponential backoff (1s, 2s, 4s, 3 attempts)
- **SSL enforcement:** `sslmode=require` injected automatically if missing from connection URL
- **Indexes:** Added on frequently queried fields (slug, authorId, gameId, etc.)
- **Select only needed fields:** Use `select` instead of `include` when possible
- **Avoid N+1:** Use `include` or `findMany` with relations instead of separate queries
- **Serialize dates:** Use `serialize()` from `api-utils.ts` to convert Date objects to strings
