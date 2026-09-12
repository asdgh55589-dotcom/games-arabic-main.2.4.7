# Authentication System

> **Last Updated:** 2026-08-20

## Overview

Games Arabic uses a hybrid authentication system:
- **Supabase Auth** for OAuth login flows (Google, Discord, Telegram)
- **Neon DB (Prisma)** for user data, roles, and permissions
- **JWT Role Cookie** (`ga_admin_role`) for Edge-compatible admin protection

## Architecture

```
User → Supabase Auth (OAuth) → Callback → syncNeonUser() → Neon DB
                                                    ↓
                                          setRoleCookie() → JWT in cookie
                                                    ↓
                                     Middleware reads cookie → Edge auth check
```

### Flow

1. User clicks "Login with Google/Discord/Telegram"
2. Redirected to Supabase Auth OAuth flow
3. On success, Supabase redirects to `/api/auth/callback`
4. Callback handler calls `syncNeonUser()` to create/update user in Neon DB
5. `setRoleCookie()` signs a JWT with `userId`, `role`, and `tokenVersion`
6. JWT stored as httpOnly cookie `ga_admin_role`
7. On subsequent requests, middleware reads the cookie to check authorization

## Supabase Auth Integration

### Client Setup

```typescript
// src/lib/supabase/client.ts — browser client
// src/lib/supabase/server.ts — server-side client
// src/lib/supabase/middleware.ts — Edge middleware client
```

### OAuth Providers

| Provider | Config Location | Callback URL |
|----------|----------------|--------------|
| Google | Supabase Dashboard → Auth → Providers → Google | `/api/auth/callback` |
| Discord | Supabase Dashboard → Auth → Providers → Discord | `/api/auth/callback` |
| Telegram | Custom Deep Link flow (see below) | `/api/auth/telegram` |

### User Sync

When a user logs in via OAuth, `syncNeonUser()` in `src/lib/auth.ts`:

1. Looks for existing user by `supabaseId` or `email`
2. If found, updates `supabaseId` if missing
3. If not found, creates new user with `role: 'member'`
4. Returns `{ id, username, email, role, avatarUrl }`

## JWT Role Cookie System

### Cookie Details

| Property | Value |
|----------|-------|
| Name | `ga_admin_role` |
| Type | httpOnly, secure (production), SameSite lax |
| Duration | 7 days |
| Domain | From `COOKIE_DOMAIN` env var (optional) |

### JWT Payload

```typescript
{
  userId: string,    // User ID in Neon DB
  role: string,      // 'member' | 'moderator' | 'admin' | 'owner'
  tv: number,        // tokenVersion — for instant session invalidation
  iat: number,       // Issued at
  exp: number,       // Expiration (7 days)
}
```

### Signing

- Algorithm: HMAC-SHA256
- Secret: `JWT_SECRET` environment variable
- Library: `jose` (Edge-compatible)

## Auth Helpers

### `getSession()`

Reads the current session — checks Supabase Auth then fetches user from Neon DB.

```typescript
import { getSession } from '@/lib/auth'

const user = await getSession()
if (user) {
  console.log(user.username, user.role)
}
```

Returns `SessionUser | null`:
```typescript
interface SessionUser {
  id: string
  username: string
  email: string
  role: UserRole
  avatarUrl: string | null
}
```

### `getOptionalSession()`

Same as `getSession()` but never throws. Safe to use anywhere.

```typescript
const user = await getOptionalSession()
```

### `requireAuth()`

Throws `AuthError(401)` if not logged in.

```typescript
import { requireAuth, AuthError } from '@/lib/auth'

try {
  const user = await requireAuth()
  // user is guaranteed to exist
} catch (e) {
  if (e instanceof AuthError) {
    return fail('UNAUTHORIZED', e.message, e.status)
  }
}
```

### `requireAdmin()`

Throws `AuthError(403)` if not admin or owner.

```typescript
const user = await requireAdmin() // admin | owner
```

### `requireModerator()`

Throws `AuthError(403)` if not moderator, admin, or owner.

```typescript
const user = await requireModerator() // moderator | admin | owner
```

### `requireOwner()`

Throws `AuthError(403)` if not owner.

```typescript
const user = await requireOwner() // owner only
```

## Role System

### Roles (Highest to Lowest — hierarchy: owner > manager > admin > moderator > publisher > member)

| Role | Level | Permissions | Admin Panel |
|------|-------|-------------|-------------|
| `owner` | 6 | Everything + manage roles + site settings | Yes (all) |
| `manager` | 5 | Same as admin (accepted by `requireAdmin()`) | Yes (all admin) |
| `admin` | 4 | All mods/games + user management | Yes (most) |
| `moderator` | 3 | Publish/edit own mods | Yes (limited: mods/comments/reports) |
| `publisher` | 2 | Can create content (upload) | No |
| `member` | 1 | Browse, endorse, comment | No |

### Permission Helpers

```typescript
import { canEditMod, canDelete } from '@/lib/auth'

// Can this user edit this mod?
if (canEditMod(user, { authorId: mod.authorId })) {
  // Yes
}

// Can this user delete?
if (canDelete(user)) {
  // Only admin/owner
}
```

### Permission Matrix

| Action | member | moderator | admin | owner |
|--------|--------|-----------|-------|-------|
| Browse mods | Yes | Yes | Yes | Yes |
| Endorse mods | Yes | Yes | Yes | Yes |
| Comment | Yes | Yes | Yes | Yes |
| Upload mod | No | Own only | All | All |
| Edit mod | No | Own only | All | All |
| Delete mod | No | No | Yes | Yes |
| Manage users | No | No | Yes | Yes |
| Manage roles | No | No | No | Yes |
| Site settings | No | No | No | Yes |

## Middleware Protection

### Protected Routes

| Route Pattern | Protection (Edge) | Response |
|---------------|-----------|--------|
| `/admin/*` (except `/admin/login`) | `ga_admin_role` JWT + `tokenVersion` Redis check (1s timeout, fail-open). No Supabase call. Role must be `moderator`\|`manager`\|`admin`\|`owner`. | 302 → `/admin/login?from=…` (with `x-auth-reason: invalid_jwt` if cookie present but invalid) |
| `/api/admin/*` | Same JWT + tv cache check | 401 `UNAUTHORIZED` or 403 `FORBIDDEN` JSON |
| `/admin/login`, `/api/auth/login` | Public | None |
| All other routes | Supabase session refresh (8s timeout, fail-open) + `?view=` 301 redirects + security headers | None |

Supabase session refresh is fail-open: if Supabase is unreachable, public routes still work. Admin routes rely solely on the JWT cookie, so Telegram-authenticated users are not blocked when Supabase is slow.

### IP Ban Checking (Write-Only, Fail-Open)

Middleware checks IP bans **only for write/sensitive paths** to avoid blocking reads on Redis failure:

```typescript
const isWritePath =
  (pathname.startsWith('/api/auth') && req.method !== 'GET') ||
  (pathname.startsWith('/api/comments') && req.method !== 'GET') ||
  (pathname.startsWith('/api/mods') && req.method !== 'GET') ||
  pathname.startsWith('/api/admin/users')

if (isWritePath) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
         || req.headers.get('x-real-ip')
    if (ip) {
      const ipBan = await getIpBanCache(ip) // Redis key ipban:<ip>, TTL 1 week
      if (ipBan?.banned) {
        return NextResponse.json({ error: 'تم حظر عنوان IP الخاص بك', code: 'IP_BANNED' }, { status: 403 })
      }
    }
  } catch (err) {
    console.error('[Middleware] IP ban check failed:', err) // fail-open
  }
}
```

### Edge Runtime Constraint (Updated)

**IMPORTANT:** Middleware runs in Edge runtime. You CANNOT import Prisma or Node-only modules. Use:
- `jose` for JWT verification
- `@/lib/ip-ban-cache` for Redis IP checks (`getIpBanCache`)
- `@/lib/token-version-cache` for `tokenVersion` checks (`getTokenVersionCache`), 1s `Promise.race` timeout, fail-open

### Edge Runtime Summary (see also `src/middleware.ts:1-60` header)

- `src/middleware.ts` comment explains in Arabic why Edge cannot use Prisma
- `ROLE_COOKIE_NAME = 'ga_admin_role'`, `JWT_SECRET` from env, `PUBLIC_ADMIN_PATHS = ['/admin/login']`
- `getRoleFromCookie()` does `jwtVerify` + `getTokenVersionCache(userId)` race (1s)
- `copyCookies()` preserves Supabase refresh cookies across redirects
- `addSecurityHeaders()` sets HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy

## IP Ban System

### How It Works

1. Admin bans an IP via `/api/admin/users/[id]` (ban endpoint)
2. Ban stored in `IpBan` table in Neon DB
3. Cached in Upstash Redis via `setIpBanCache()`
4. Middleware checks Redis cache on sensitive paths
5. Server-side `checkIpBan()` does full DB check in `requireAuth()`

### Cache Layer

```typescript
// src/lib/ip-ban-cache.ts
await setIpBanCache(ip, { banned: true, reason, expiresAt })
await deleteIpBanCache(ip)
const ban = await getIpBanCache(ip)
```

Cache keys: `ipban:<ip>`, TTL: 1 week (or until ban expires).

### Ban Types

| Type | `banStatus` | `bannedUntil` | Behavior |
|------|-------------|---------------|----------|
| Active | `active` | null | Not banned |
| Temporary | `banned_temp` | Date | Banned until date |
| Permanent | `banned_perm` | null | Banned forever |
| Restricted | `restricted` | null | Limited (not fully banned) |

## Session Invalidation

### Token Versioning

Each user has a `tokenVersion` field. When a user is banned or their role changes:

```typescript
await invalidateUserSessions(userId) // increments tokenVersion
```

This invalidates all existing JWT cookies because the middleware and `getSession()` verify `tokenVersion` matches.

### How Invalidation Works

1. `tokenVersion` incremented in DB
2. Existing cookies have old `tv` value
3. `getSession()` checks `cookie.tv === db.tokenVersion`
4. If mismatch → cookie deleted, session considered expired
5. User must log in again

## Adding Protected Routes

### API Route (Server-Side)

```typescript
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    // user is authenticated
  } catch (e) {
    if (e instanceof AuthError) {
      return fail('UNAUTHORIZED', e.message, e.status)
    }
    return internalError()
  }
}
```

### Middleware (Edge)

Add your path to the middleware matcher or add specific checks in the middleware function. The existing middleware handles `/admin/*` and `/api/admin/*` automatically.

### Client-Side

```typescript
const user = await getOptionalSession()
if (!user) {
  // Redirect to login or show login prompt
}
```

## Environment Variables

```env
# Required
JWT_SECRET="your-secret-key"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Optional
COOKIE_DOMAIN="yourdomain.com"
```

## JWT_SECRET Rotation

> **Critical:** Changing `JWT_SECRET` invalidates all existing sessions.

### Steps

1. Update **both** `.env` and `.env.local` with the same new secret:
   ```env
   JWT_SECRET="new-secret-key-here"
   ```
2. Restart the dev server (`bun run dev`) or redeploy in production
3. **Option A — Automatic:** Old cookies are rejected automatically. `src/app/api/auth/me/route.ts` clears invalid cookies on next request (`cookieStore.delete(ROLE_COOKIE_NAME)`), and `src/middleware.ts` logs `[middleware] invalid role cookie` with `x-auth-reason: invalid_jwt` header
4. **Option B — Manual:** Run `await invalidateUserSessions(userId)` for specific users, or instruct all users to logout and login again
5. Verify in logs: `[auth/me] invalid role cookie — clearing` and `[middleware] invalid role cookie:` warnings confirm cleanup

### Why Stale Cookies Fail

- Cookies are signed with `jose.jwtVerify(secret)` — a different `JWT_SECRET` causes verification to throw
- `src/middleware.ts:66` catches this and returns `null` (treated as unauthenticated)
- `src/app/api/auth/me/route.ts:84` does the same but now also deletes the cookie
- The login page (`src/app/admin/login/page.tsx`) shows "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى." when redirected via `?from=`

### Prevention

- Never change `JWT_SECRET` without coordinating a re-login window
- Keep `.env` and `.env.local` synchronized — `.env.local` wins in `next dev` but `.env` is used in production builds
- Test rotation locally: corrupt `ga_admin_role` cookie → should auto-clear and show login message

## Security Features
- **HttpOnly cookies** — JavaScript cannot access the JWT
- **Secure cookies** — Only sent over HTTPS in production
- **SameSite Lax** — CSRF protection
- **JWT signing** — HMAC-SHA256 prevents tampering
- **Token versioning** — Instant session invalidation
- **Rate limiting** — Via Upstash Redis
- **IP banning** — Edge-compatible via Redis cache
- **Audit logging** — All admin actions logged

## Onboarding Gate (`ob` claim)

New signups must complete `/onboarding` (confirm data, pick username, set
first password) before entering the site; pre-existing accounts are
grandfathered (`User.onboardingCompleted = true`).

- **Source of truth:** `User.onboardingCompleted` in the DB, enforced
  server-side by `requireOnboarded()` (`src/lib/auth.ts`) — non-members
  always pass; `member + !onboardingCompleted` throws 403.
- **Edge signal:** the `ga_admin_role` JWT carries an `ob` boolean claim
  (`setRoleCookie(..., onboarded)`). `src/proxy.ts` reads it via the pure,
  Edge-safe `getOnboardingGate()` (`src/lib/onboarding.ts`): members with
  `ob === false` get a 302 to `/onboarding?from=<path>` for pages and a
  403 `{ code: 'ONBOARDING_REQUIRED' }` for `/api/*`.
- **Fail-open at Edge:** legacy cookies without the claim (`ob === undefined`)
  are allowed through — the DB check remains authoritative.
- **Exempt paths** (reachable while incomplete): `/onboarding`, `/login`,
  `/verify-email`, auth API (`callback`, `telegram*`, `onboarding`,
  `recover`, `reset-password`, `send-verification-email`, `mfa`, `me`,
  `logout`, ledgers), link-account settings routes. Full list:
  `EXEMPT_PREFIXES` in `src/lib/onboarding.ts`.
- Related guards: `POST /api/creator-requests` rejects non-onboarded
  members (`أكمل إعداد حسابك أولاً`); synthetic `@telegram.local`
  identities can never receive recovery mail (`isSyntheticTelegramEmail`).

## Recovery Flow (single-use, 1h, hash at rest)

- `POST /api/auth/recover` (`src/app/api/auth/recover/route.ts`): looks up
  the user by email, invalidates older unused tokens, stores **only the
  SHA-256 hash** (`PasswordResetToken.tokenHash`, `RECOVERY_TTL_MS = 1h`),
  emails the raw token (Resend). The raw token never touches the DB.
- `POST /api/auth/reset-password`: hashes the presented token, rejects
  unknown / used (`usedAt`) / expired rows, sets the new password, then
  stamps `usedAt` — single-use enforced at the row.
- `POST /api/auth/send-verification-email`: (re)sends the Supabase
  verification mail (`emailRedirectTo: '/verify-email'`), rate-limited
  (`auth:resend-verify`, 5/10min).
- UI: `/recover` → email form; `/reset-password` → new-password form.

## Telegram Widget Contract (`data-onauth`)

The official Telegram Login Widget does **not** `postMessage` — it calls a
**window-global function** named in the injected script's `data-onauth`
attribute. Locked in `src/lib/telegram-widget.ts` so component and views
cannot drift:

- Loader: `https://telegram.org/js/telegram-widget.js?22`
- Global callback name: `onTelegramAuth` (`TELEGRAM_WIDGET_CALLBACK_NAME`);
  the component assigns `window.onTelegramAuth = onAuth`.
- Script attributes (`buildTelegramWidgetAttributes`): `data-telegram-login`,
  `data-size=large`, `data-radius=8`, `data-request-access=write`,
  `data-userpic=true`, `data-lang=ar`,
  **`data-onauth="onTelegramAuth(user)"`**.
- Client-safe bot name: **only** `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is
  visible in the browser — gating widget UI on server-only
  `TELEGRAM_BOT_NAME` silently disables it (`getTelegramBotUsername()`).
- Server: `/api/auth/telegram*` routes verify the payload hash, bridge or
  deep-link the session; widget polling via `/api/auth/telegram/poll`.
