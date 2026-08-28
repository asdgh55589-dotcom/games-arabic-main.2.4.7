# API Standardization

> **Last Updated:** 2026-08-20 — 147 handlers under `src/app/api/**`

## Response Format Standard

All API routes return one of three shapes:

### Success (Single Resource)

```json
{ "data": { "id": "abc", "name": "Example" } }
```

### Success (Paginated List)

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 150,
    "totalPages": 7
  }
}
```

### Success (Paginated with Metadata)

```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 24, "total": 150, "totalPages": 7 },
  "meta": { "unreadCount": 5 }
}
```

### Error

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {}
  }
}
```

## Response Helpers

All helpers are in `src/lib/api-response.ts`.

| Helper | HTTP Status | Response Shape | Usage |
|--------|-------------|----------------|-------|
| `ok(data)` | 200 | `{ data }` | Single resource or array |
| `okPaginated(data, pagination)` | 200 | `{ data, pagination }` | Paginated list |
| `okPaginatedWithMeta(data, pagination, meta)` | 200 | `{ data, pagination, meta }` | Paginated + extra info |
| `fail(code, message, status)` | Custom | `{ error: { code, message, details? } }` | Custom error |
| `notFound()` | 404 | `{ error: { code: "NOT_FOUND", message: "Resource not found" } }` | Resource not found |
| `unauthorized()` | 401 | `{ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }` | Not authenticated |
| `forbidden()` | 403 | `{ error: { code: "FORBIDDEN", message: "Forbidden" } }` | Insufficient permissions |
| `validationFail(details)` | 422 | `{ error: { code: "VALIDATION_ERROR", message: "Invalid input", details } }` | Validation failed |
| `rateLimited()` | 429 | `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }` | Rate limited |
| `conflict()` | 409 | `{ error: { code: "CONFLICT", message: "Resource already exists" } }` | Duplicate resource |
| `internalError()` | 500 | `{ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }` | Server error |

### Usage Examples

```typescript
import { ok, okPaginated, notFound, validationFail, unauthorized } from '@/lib/api-response'

// Single resource
return ok({ id: '123', name: 'My Mod' })

// Paginated list
return okPaginated(mods, { page: 1, limit: 24, total: 100, totalPages: 5 })

// Not found
return notFound()

// Validation error with Zod details
const parsed = CreateModSchema.safeParse(body)
if (!parsed.success) return validationFail(parsed.error.flatten())

// Unauthorized
return unauthorized('Please log in')
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid input data |
| `RATE_LIMITED` | 429 | Too many requests |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Server error |
| `IP_BANNED` | 403 | IP address is banned |

## Auth Helpers

All in `src/lib/auth.ts`.

### `requireAuth()`

Throws `AuthError(401)` if not logged in. Returns `SessionUser`.

```typescript
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    // user.id, user.username, user.role, etc.
  } catch (e) {
    if (e instanceof AuthError) {
      return fail('UNAUTHORIZED', e.message, e.status)
    }
    return internalError()
  }
}
```

### `getOptionalSession()`

Returns `SessionUser | null` — never throws.

```typescript
import { getOptionalSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getOptionalSession()
  const isOwner = user?.id === resource.authorId
  return ok({ resource, isOwner })
}
```

### `requireAdmin()` / `requireModerator()` / `requireOwner()`

Role-based variants that throw `AuthError(403)` if role is insufficient.

```typescript
const user = await requireAdmin()    // admin | owner
const user = await requireModerator() // moderator | admin | owner
const user = await requireOwner()     // owner only
```

## Pagination

Use `parsePagination()` from `src/lib/api-utils.ts`:

```typescript
import { parsePagination } from '@/lib/api-utils'

const { page, limit } = parsePagination(
  searchParams.get('page'),
  searchParams.get('limit'),
  { limit: 24, maxLimit: 100 }
)
```

Then combine with `okPaginated`:

```typescript
const [total, mods] = await Promise.all([
  db.mod.count({ where }),
  db.mod.findMany({ where, skip: (page - 1) * limit, take: limit }),
])

return okPaginated(serialize(mods), {
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
})
```

## Sorting

Use `pickSort()` from `src/lib/api-utils.ts`:

```typescript
import { pickSort } from '@/lib/api-utils'

const SORTS = ['downloads', 'endorsements', 'newest'] as const
const sort = pickSort(searchParams.get('sort'), SORTS, 'downloads')
```

## All API Endpoints

### Public Endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api` | Health check (`{ data: { message } }`) |
| GET | `/api/mods` | List mods (paginated, filterable) |
| GET | `/api/mods/[slug]` | Get mod details |
| GET | `/api/mods/[slug]/comments` | List comments for mod (paginated) |
| GET | `/api/games` | List games |
| GET | `/api/games/[slug]` | Get game details |
| GET | `/api/games/[slug]/mods` | List mods for a game |
| GET | `/api/games/[slug]/categories` | List categories for a game |
| GET | `/api/series` | List series |
| GET | `/api/series/[slug]` | Get series details |
| GET | `/api/series/mods` | Mods for series |
| GET | `/api/teams` | List translation teams |
| GET | `/api/teams/[slug]` | Get team details |
| GET | `/api/news` | List news (ticker/featured, paginated) |
| GET | `/api/ads` | List homepage ads |
| GET | `/api/sections` | List dynamic platform sections |
| GET | `/api/search` | Search mods/games |
| GET | `/api/stats` | Site statistics |
| GET | `/api/home` | Homepage aggregated data |
| GET | `/api/youtube/metadata` | YouTube oEmbed metadata |
| GET | `/api/settings` | Get public site settings |
| GET | `/api/settings/robots` | Generate robots.txt |
| GET | `/api/settings/sitemap` | Generate sitemap |

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Admin login (username/password → sets `ga_admin_role`) |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/auth/me` | Get current user + auto-clears invalid JWT |
| POST | `/api/auth/callback` | OAuth callback (Google/Discord → syncNeonUser) |
| POST | `/api/auth/telegram` | Telegram Deep Link init |
| POST | `/api/auth/telegram/webhook` | Telegram bot webhook |
| POST | `/api/auth/telegram/poll` | Poll Telegram auth status |
| POST | `/api/auth/change-password` | Change password (auth required) |

### User Endpoints (Authenticated or Optional)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/[username]/profile` | Public profile |
| GET | `/api/users/[username]/full-profile` | Full profile (private fields if owner) |
| GET | `/api/users/[username]/activity` | User activity feed |
| GET | `/api/users/[username]/badges` | Tier + special role badges |
| PUT | `/api/users/[username]/avatar` | Update avatar (owner) |
| PUT | `/api/users/[username]/banner` | Update banner (owner) |
| POST | `/api/users/[username]/follow` | Follow/unfollow user |
| GET | `/api/authors/[username]/mods` | List mods by author |
| GET/POST/DELETE | `/api/bookmarks` + `/check`, `/check-batch` | Bookmark CRUD + bulk check |
| GET | `/api/notifications` + `/unread`, `/unread-count`, `/bulk` | List / unread / bulk ops |
| PUT | `/api/notifications/[id]/read`, `/read-all` | Mark read |
| GET/PUT | `/api/notifications/preferences` | Get/update preferences (quiet hours, type prefs) |
| POST | `/api/comments/[id]/like`, `/dislike` | Like/dislike comment |
| PUT/DELETE | `/api/comments/[id]` | Edit/delete own comment |
| POST | `/api/mods/[slug]/endorse` | Toggle endorsement |
| POST | `/api/mods/[slug]/download`, `/download/[linkId]` | Track download click |
| POST | `/api/mods/[slug]/comments` | Add comment (guest via `guestName` or auth) |
| POST | `/api/teams/[slug]/follow` | Follow/unfollow team |
| POST | `/api/reports` | Submit report (mod/comment/user) |
| POST | `/api/storage/upload-url` | Get pre-signed upload URL |
| GET | `/api/sections` | (also public, listed above) |

### Admin Endpoints (Moderator+ / Manager+ / Owner — 100+ handlers)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET/POST | `/api/admin/mods` | List / create mod (admin view) |
| GET/PUT/DELETE | `/api/admin/mods/[id]` | Get/update/delete mod |
| POST | `/api/admin/mods/bulk` | Bulk operations |
| GET | `/api/admin/mods/check-duplicate` | Duplicate detection |
| POST | `/api/admin/mods/[id]/duplicate` | Duplicate mod |
| POST | `/api/admin/mods/[id]/generate-post` | Generate scheduled post |
| GET/PUT | `/api/admin/mods/[id]/workflow` | Change workflow status |
| GET | `/api/admin/mods/[id]/versions` | Version history |
| GET | `/api/admin/mods/[id]/ratings` | Mod ratings |
| GET/POST | `/api/admin/games` + `PUT/DELETE /[id]` | Game CRUD |
| GET | `/api/admin/games/[id]` | Game detail |
| GET/POST | `/api/admin/series` + `PUT/DELETE /[id]` | Series CRUD |
| GET/POST | `/api/admin/teams` + `PUT/DELETE /[id]` | Team CRUD |
| GET | `/api/admin/teams/[id]/members` | Manage members |
| GET | `/api/admin/teams/[id]/mods` | Team mods |
| GET | `/api/admin/teams/[id]/achievements`, `/dashboard`, `/rewards`, `/quality-report` | Team analytics |
| GET/PUT | `/api/admin/users` + `/[id]`, `/[id]/ban`, `/unban`, `/warn`, `/tier`, `/tier/revoke`, `/special-role` | User management |
| GET | `/api/admin/users/analytics/*` + `/inactive/alert`, `/export` | User analytics + export |
| GET | `/api/admin/comments` + `PUT/DELETE /[id]` | Comment moderation |
| GET | `/api/admin/endorsements` | Endorsement admin |
| GET | `/api/admin/reports` + `PUT /[id]`, `POST /[id]/confirm|reject`, `/stats`, `/export`, `/[id]/history` | Report handling |
| GET/POST | `/api/admin/news` + `PUT/DELETE /[id]` | News management |
| GET/POST | `/api/admin/ads` + `PUT/DELETE /[id]` | Ads management |
| GET/POST | `/api/admin/sections` + `PUT/DELETE /[id]` | Dynamic platform sections |
| GET/PUT | `/api/admin/settings` | Site settings |
| GET | `/api/admin/audit` + `/export` | Audit log + export |
| GET | `/api/admin/activity-log` | Activity log |
| GET/PUT | `/api/admin/tier-rules` + `/[tier]` | Tier rules |
| GET | `/api/admin/tier-history` | Tier change history |
| GET/POST | `/api/admin/special-roles` + `PUT/DELETE /[key]` | Special roles |
| GET | `/api/admin/analytics/*` | Analytics (downloads, engagement, funnel, growth, heatmap, platforms, team-quality, top-teams) |
| GET/POST | `/api/admin/templates` + `GET /[id]`, `/[id]/preview` | Notification templates |
| GET | `/api/admin/notifications-health` + `/notifications/[id]` | Notification health |
| GET/POST | `/api/admin/tickets` + `GET/PUT /[id]`, `POST /[id]/messages` | Support tickets |
| GET/POST | `/api/admin/scheduler` + `/searches`, `/search` | Scheduled jobs + search admin |
| GET/POST | `/api/admin/backup`, `/maintenance`, `/leaderboard` | System ops |
| POST | `/api/admin/setup` | Initial setup (owner) |

## How to Add a New API Endpoint

### Step 1: Create the Route File

```typescript
// src/app/api/your-resource/route.ts
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, okPaginated, notFound, fail } from '@/lib/api-response'
import { requireAuth, getOptionalSession } from '@/lib/auth'
import { parsePagination, serialize } from '@/lib/api-utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const { page, limit } = parsePagination(
    searchParams.get('page'),
    searchParams.get('limit'),
    { limit: 24 }
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

    // Validate with Zod
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

### Step 2: Add a Zod Schema (if needed)

```typescript
// src/lib/schemas.ts
export const CreateYourResourceSchema = z.object({
  name: z.string().min(1).max(200),
  // ...
})
```

### Step 3: Add Types (if needed)

```typescript
// src/lib/types.ts
export interface YourResource {
  id: string
  name: string
  // ...
}
```

### Step 4: Test

```bash
curl http://localhost:3000/api/your-resource
```
