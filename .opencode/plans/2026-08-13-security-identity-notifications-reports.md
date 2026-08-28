# Games Arabic — Security, Identity, Notifications & Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical security vulnerabilities (OAuth account takeover, admin setup), implement 6-role system, build app-owned notification system, improve report workflow, and add external download tracking — all targeting Vercel deployment.

**Architecture:** Next.js App Router monolith with Prisma + PostgreSQL (Neon), Supabase Auth for OAuth, Upstash Redis for caching/rate-limiting, Resend for email. All changes are additive migrations + route modifications.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Prisma 6, PostgreSQL (Neon), Supabase Auth, Upstash Redis, Resend, Vercel Cron, Zod 4, shadcn/ui

## Global Constraints

- Deployment target: Vercel (serverless, Edge middleware)
- Database: PostgreSQL via Neon (Prisma ORM)
- Auth: Supabase Auth for OAuth + JWT role cookie for Edge middleware
- Redis: Upstash (REST-based, Edge-compatible)
- Node-cron: NOT compatible with Vercel — use Vercel Cron instead
- Role hierarchy (ascending): member → publisher → moderator → admin → manager → owner
- Arabic-first RTL layout (`dir="rtl"` on `<html>`)
- ESLint: very permissive (`no-explicit-any: off`)
- TypeScript: `strict: true`, `noImplicitAny: false`

---

## Phase 1: Identity and OAuth Account Fix

### Goal
Eliminate the critical OAuth account takeover vulnerability by introducing a dedicated `OAuthAccount` table, removing email-based user matching from OAuth flows, and supporting multi-provider account linking.

### Database Changes

**New model: `OAuthAccount`**

```prisma
model OAuthAccount {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider          String   // google | discord | telegram
  providerAccountId String   // Supabase Auth user ID or Telegram ID
  providerEmail     String?  // email from provider (may be null for Telegram)
  providerUsername   String?  // username from provider
  avatarUrl         String?  // avatar from provider
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@index([provider])
}
```

**User model changes:**
- REMOVE: `provider` field (line 19 of schema)
- REMOVE: `providerAccountId` field (line 20 of schema)
- KEEP: `supabaseId` (still needed for Supabase Auth session lookup)
- ADD: `oauthAccounts OAuthAccount[]` relation

**Migration steps:**
1. Create `OAuthAccount` table
2. Migrate existing data: for each User with `provider != 'email'`, create an `OAuthAccount` row with `provider = User.provider`, `providerAccountId = User.providerAccountId` (or `User.supabaseId` for OAuth users)
3. Remove `provider` and `providerAccountId` columns from `User`

### API Changes

**1. OAuth callback (`src/app/api/auth/callback/route.ts`)**

Current flow (BROKEN):
```
lookup by supabaseId OR email → if found, update supabaseId/provider → create role cookie
```

New flow (SAFE):
```
lookup by supabaseId → if found, update lastLoginAt → create role cookie
if not found by supabaseId:
  lookup OAuthAccount by (provider, providerAccountId) → if found, user exists → create role cookie
  if not found by OAuthAccount:
    lookup by email → if found, BLOCK (prompt user to log in with existing provider, then link from settings)
    if not found by email:
      create new User + new OAuthAccount → create role cookie
```

**2. New endpoint: `src/app/api/settings/link-account/route.ts`**

POST — Link a new OAuth provider to the current user.
- Requires: authenticated user, valid OAuth session
- Creates: new `OAuthAccount` row for the current user
- Validates: no duplicate `(provider, providerAccountId)`, no duplicate email across users

**3. New endpoint: `src/app/api/settings/unlink-account/route.ts`**

POST — Remove an OAuth provider link.
- Requires: authenticated user
- Validates: user has at least 2 linked providers (cannot unlink last one)
- Validates: user is not unlinking their only login method

**4. New endpoint: `src/app/api/settings/linked-accounts/route.ts`**

GET — List linked OAuth providers for the current user.

**5. Update `syncNeonUser()` in `src/lib/auth.ts`**

Remove email-based matching. Only match by `supabaseId`.

**6. Update Telegram login (`src/app/api/auth/telegram/poll/route.ts` and `webhook/route.ts`)**

After login, create/update `OAuthAccount` with `provider: 'telegram'`, `providerAccountId: telegramId.toString()`. Telegram has no email — `providerEmail` is null.

**7. Update `src/lib/schemas.ts`**

Remove `provider` and `providerAccountId` from `CreateUserSchema`.

### UI Changes

**Settings page (`src/views/settings.tsx`):**
- Add "Linked Accounts" section
- Show each linked provider with icon, username, and unlink button
- Show "Link Google" / "Link Discord" / "Link Telegram" buttons for unlinked providers
- Prevent unlinking the last provider

### Files Likely Affected

- `prisma/schema.prisma` — new model, User field removal
- `src/app/api/auth/callback/route.ts` — rewrite user matching logic
- `src/app/api/auth/telegram/poll/route.ts` — create OAuthAccount
- `src/app/api/auth/telegram/webhook/route.ts` — create OAuthAccount
- `src/lib/auth.ts` — update `syncNeonUser()`, `getSession()`
- `src/lib/schemas.ts` — remove provider from CreateUserSchema
- `src/views/settings.tsx` — add linked accounts UI
- New: `src/app/api/settings/link-account/route.ts`
- New: `src/app/api/settings/unlink-account/route.ts`
- New: `src/app/api/settings/linked-accounts/route.ts`
- New: `prisma/migrations/XXXX_add_oauth_accounts/`

### Edge Cases

- **Telegram user with no email:** `providerEmail` is null. User can still log in. The email field on User is `telegram_{id}@telegram.local` (existing pattern).
- **User tries to link a provider already linked to another account:** Return 409 Conflict with message "This account is already linked to another user."
- **User tries to link a provider they already have linked:** Return 409 Conflict with message "You already have this provider linked."
- **OAuth callback finds email match but user refuses to link:** Show error page: "An account with this email already exists. Please log in with your existing provider and link accounts from Settings."
- **Race condition on concurrent link requests:** Use `@@unique([provider, providerAccountId])` constraint + try/catch on create.

### Security Considerations

- Email-based matching is REMOVED from OAuth callback — this eliminates the account takeover vector
- The `@@unique([provider, providerAccountId])` constraint prevents duplicate provider links
- Unlinking the last provider is blocked — user always has a login method
- Telegram webhook should add `X-Telegram-Bot-Api-Secret-Token` verification

### Required Tests

1. **OAuth callback — existing user by supabaseId:** User logs in with Google, finds by supabaseId, logs in successfully
2. **OAuth callback — new user:** New Discord user, no matching supabaseId or email, creates new User + OAuthAccount
3. **OAuth callback — email collision blocked:** Existing user has `user@example.com`. Attacker tries Discord with same email. Should be blocked with appropriate error.
4. **Link account — success:** Authenticated user links a new provider
5. **Link account — duplicate provider:** User tries to link a provider they already have
6. **Link account — provider owned by another user:** Provider already linked to different user
7. **Unlink account — last provider blocked:** User with 1 provider tries to unlink
8. **Unlink account — success:** User with 2+ providers removes one
9. **Telegram login — no email:** Telegram user creates account with `telegram_{id}@telegram.local`

### Risks

- **Data migration:** Existing users with `provider != 'email'` need `OAuthAccount` rows created. Write a migration script.
- **Supabase Auth sync:** Supabase still has its own auth users. The `supabaseId` field on User must remain for session lookup. `OAuthAccount` is the application-level link.
- **Breaking change:** Any code referencing `User.provider` or `User.providerAccountId` must be updated.

---

## Phase 2: Six-Role System

### Goal
Implement the full 6-role hierarchy: member → publisher → moderator → admin → manager → owner. Add the `publisher` and `manager` roles with clear permission boundaries.

### Database Changes

**User model update:**
```prisma
role String @default("member") // member | publisher | moderator | admin | manager | owner
```

No schema change needed — the `role` field is already a String. The change is in validation and logic.

### Permission Matrix

| Action | member | publisher | moderator | admin | manager | owner |
|--------|--------|-----------|-----------|-------|---------|-------|
| View public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment on mods | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Endorse/vote on mods | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bookmark mods | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Follow users/teams | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload mods (own) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own mods | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete own mods | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit any mod | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Moderate comments | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ban users | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage games/series | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage reports | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage admin panel | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage settings | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage roles | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage tiers | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| View audit log | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage maintenance | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create owner accounts | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**How publisher differs from member:**
- Publisher can upload and edit their own mods
- Publisher cannot delete mods or moderate content
- Publisher is the entry-level content creator role

**How manager differs from admin:**
- Manager can manage site settings (admin cannot)
- Manager can manage roles (admin cannot promote beyond moderator)
- Manager can manage maintenance mode
- Manager is the operational lead; admin is the content lead

### API Changes

**1. Update `src/lib/auth.ts`**

Add new role helpers:
```typescript
export async function requirePublisher(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!['publisher', 'moderator', 'admin', 'manager', 'owner'].includes(user.role)) {
    throw new AuthError('Forbidden — publisher access required', 403)
  }
  return user
}

export async function requireManager(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!['manager', 'owner'].includes(user.role)) {
    throw new AuthError('Forbidden — manager access required', 403)
  }
  return user
}
```

Update `canEditMod()`:
- `publisher`: only own mods
- `moderator`: any mod
- `admin+`: any mod

Update `canDelete()`:
- `moderator+`: can delete

**2. Update middleware (`src/middleware.ts`)**

Update role check at line 136:
```typescript
const VALID_ROLES = ['publisher', 'moderator', 'admin', 'manager', 'owner']
if (!VALID_ROLES.includes(rolePayload.role)) { ... }
```

**3. Update admin route protection**

- `/api/admin/*` (read): `requireModerator()` — unchanged
- `/api/admin/users/*` (manage): `requireAdmin()` — unchanged
- `/api/admin/settings/*`: change to `requireManager()`
- `/api/admin/setup`: remains special (owner creation)
- `/api/admin/audit/*`: `requireAdmin()` — unchanged

**4. Update upload route**

Change from `requireModerator()` to `requirePublisher()` for mod creation.

**5. Update `src/lib/schemas.ts`**

Update `CreateUserSchema` role enum:
```typescript
role: z.enum(['member', 'publisher', 'moderator', 'admin', 'manager']).default('member')
```

**6. Update admin user management**

- Admin can assign: member, publisher, moderator
- Manager can assign: member, publisher, moderator, admin
- Owner can assign: all roles including owner

### UI Changes

**Admin panel:**
- Role dropdown in user management includes all 6 roles
- Role assignment restrictions based on current user's role

**Profile badges:**
- Add publisher and manager badge variants

### Files Likely Affected

- `src/lib/auth.ts` — new role helpers, update canEditMod/canDelete
- `src/middleware.ts` — update valid roles list
- `src/lib/schemas.ts` — update CreateUserSchema role enum
- `src/app/api/admin/users/route.ts` — role assignment restrictions
- `src/app/api/admin/users/[id]/route.ts` — role update restrictions
- `src/app/api/admin/settings/route.ts` — requireManager()
- `src/app/api/admin/mods/route.ts` — upload permission for publishers
- `src/components/admin/` — role badge updates
- `src/views/settings.tsx` — role display
- `src/views/profile.tsx` — role badge display

### Edge Cases

- **Existing users with old roles:** No migration needed — roles are strings. Old `moderator` users remain `moderator`. New roles are only assigned by admins.
- **Publisher tries to access admin panel:** Middleware redirects to /admin/login with insufficient_role error.
- **Manager tries to create owner:** Only owner can create owner (existing check in `src/app/api/admin/users/route.ts:91`).

### Security Considerations

- Role assignment is restricted by the assigning user's role level
- Middleware + server-side双重检查 (defense in depth)
- `requireManager()` is stricter than `requireAdmin()` — only owner and manager pass

### Required Tests

1. **Publisher can upload mods:** Publisher POSTs to `/api/admin/mods`, succeeds
2. **Member cannot upload mods:** Member POSTs to `/api/admin/mods`, gets 403
3. **Publisher cannot delete mods:** Publisher tries DELETE on mod, gets 403
4. **Moderator can delete mods:** Moderator DELETE succeeds
5. **Admin cannot manage settings:** Admin PUTs to `/api/admin/settings`, gets 403
6. **Manager can manage settings:** Manager PUT succeeds
7. **Role assignment restrictions:** Admin tries to assign `owner`, gets forbidden
8. **Middleware blocks publisher from admin pages:** Publisher visits /admin, redirected

### Risks

- **Role creep:** Ensure the permission matrix is enforced consistently across all routes
- **Backward compatibility:** Existing API consumers expecting 4 roles need to handle 6

---

## Phase 3: Seven Main Sections and External Downloads

### Goal
Define the 7 main content sections of the platform, implement section management, and build a safe external download system with tracking and redirect warnings.

### Database Changes

**New model: `Section`**

```prisma
model Section {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String   // Arabic name
  nameEn      String   // English name
  description String   @default("")
  icon        String   @default("Folder") // Lucide icon name
  color       String   @default("#6b7280")
  order       Int      @default(0)
  isActive    Boolean  @default(true)
  isMain      Boolean  @default(true) // true = one of the 7 main sections
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isMain, isActive])
  @@index([order])
}
```

**Mod model update:**
- ADD: `sectionId String?` (optional FK to Section)
- ADD: `section Section? @relation(fields: [sectionId], references: [id])`

**New model: `DownloadClick`**

```prisma
model DownloadClick {
  id         String   @id @default(cuid())
  modId      String
  mod        Mod      @relation(fields: [modId], references: [id], onDelete: Cascade)
  fileId     String?
  linkId     String?
  linkUrl    String   // the external URL clicked
  userId     String?  // null if anonymous
  ipAddress  String?
  userAgent  String?
  referrer   String?
  createdAt  DateTime @default(now())

  @@index([modId])
  @@index([createdAt])
}
```

### API Changes

**1. Section CRUD**

- `GET /api/sections` — list all sections (public)
- `POST /api/admin/sections` — create section (requireManager)
- `PUT /api/admin/sections/[id]` — update section (requireManager)
- `DELETE /api/admin/sections/[id]` — delete section (requireManager)
- Validation: max 7 active main sections enforced at application level

**2. Download tracking endpoint**

`GET /api/mods/[slug]/download/[linkId]`

Flow:
1. Validate linkId exists and belongs to the mod
2. Create `DownloadClick` record (fire-and-forget)
3. Increment `Mod.downloads` atomically
4. Return JSON with `{ url: externalUrl }` — client handles redirect with warning

**3. Validation for external links**

URL allowlist in `src/lib/constants.ts`:
```typescript
const ALLOWED_DOWNLOAD_HOSTS = [
  'drive.google.com',
  'mega.nz',
  'mega.io',
  'mediafire.com',
  'www.mediafire.com',
  'anonfiles.com',
  'gofile.io',
  'archive.org',
]
```

Validate in admin mod creation/edit: `ModFileLink.url` must match an allowed host.

**4. Report broken/malicious link**

Extend report with `targetType: 'download_link'` option or use existing mod report with reason `broken_link` / `malicious_link`.

### UI Changes

**Mod detail page (`src/views/mod-detail.tsx`):**
- Download section shows redirect warning before external link
- Download click counter displayed per mod

**Admin panel:**
- New section: `src/app/admin/sections/` — Section CRUD
- Mod form: section dropdown

**Navigation:**
- 7 main sections displayed in navbar/sidebar

### Files Likely Affected

- `prisma/schema.prisma` — Section model, DownloadClick model, Mod.sectionId
- `src/app/api/sections/route.ts` — new
- `src/app/api/admin/sections/route.ts` — new
- `src/app/api/admin/sections/[id]/route.ts` — new
- `src/app/api/mods/[slug]/download/[linkId]/route.ts` — new
- `src/app/api/admin/mods/route.ts` — section assignment, URL validation
- `src/app/api/admin/mods/[id]/route.ts` — section update
- `src/views/mod-detail.tsx` — redirect warning UI
- `src/components/mod-download-section.tsx` — redirect warning
- `src/lib/constants.ts` — section definitions, allowed hosts
- `src/lib/schemas.ts` — section validation, URL allowlist
- New: `src/app/admin/sections/page.tsx`
- New: `prisma/migrations/XXXX_add_sections_and_downloads/`

### Edge Cases

- **More than 7 active main sections:** Application-level check in section create/update. Return validation error if creating 8th active main section.
- **Section with linked mods:** Cannot delete section if mods are linked. Must reassign or unlink first.
- **External URL is down:** Download tracking still records the click. User sees 404 on external site.
- **User bypasses redirect warning:** The download endpoint returns the URL as JSON. The client-side warning is UX, not security. The actual security is in the URL allowlist at admin mod creation.

### Security Considerations

- **Open redirect prevention:** The download endpoint only returns URLs from the allowlist. No arbitrary URL redirect.
- **URL validation:** Admin must use allowed hosts for ModFileLink URLs. Zod schema validates at creation time.
- **Download click data:** Store IP + UserAgent for abuse detection, but hash/anonymize for privacy.
- **No file hosting:** The platform never hosts files. All downloads are external links.

### Required Tests

1. **Section CRUD:** Create, read, update, delete sections via admin API
2. **Max 7 sections:** Attempt to create 8th active main section, expect validation error
3. **Download tracking:** Click download link, verify DownloadClick record created
4. **Download count increment:** Click download, verify Mod.downloads incremented atomically
5. **URL validation:** Admin tries to add download link with disallowed host, expect validation error
6. **Redirect warning:** Download endpoint returns JSON with URL (not 302 redirect)
7. **Report broken link:** User reports a download link, report created with correct targetType

### Risks

- **Section model may conflict with existing Game.category:** Sections are a higher-level grouping. Games already have `category` (RPG, FPS, etc.). Sections are different — they represent content types or navigation sections. Clarify with product owner: are sections replacing categories, or are they a separate concept?
- **Download tracking in volume:** `DownloadClick` table will grow fast. Add a cleanup job or partition by month.

---

## Phase 4: Notification System Independent from Supabase Realtime

### Goal
Build a fully app-owned notification system using database polling + Resend email, removing the dependency on Supabase Realtime. Support Vercel Cron for scheduled email summaries.

### Database Changes

**Keep existing models (already defined):**
- `Notification` — already exists with 13 types
- `NotificationPreference` — already exists
- `NotificationLog` — already exists

**New model: `NotificationJob`** (for reliable delivery)

```prisma
model NotificationJob {
  id             String    @id @default(cuid())
  notificationId String
  notification   Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  channel        String    // in_app | email | both
  status         String    @default("pending") // pending | processing | sent | failed
  attempts       Int       @default(0)
  maxAttempts    Int       @default(3)
  lastError      String?
  scheduledFor   DateTime  @default(now())
  processedAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([status, scheduledFor])
  @@index([notificationId])
}
```

### API Changes

**1. In-app notification API (already exists, keep as-is)**

- `GET /api/notifications` — list notifications with pagination
- `GET /api/notifications/unread-count` — count unread
- `POST /api/notifications/[id]/read` — mark single as read
- `POST /api/notifications/read-all` — mark all as read

**2. Client polling strategy**

Replace Supabase Realtime with polling:

```typescript
// src/hooks/use-notification-polling.ts
// Polls /api/notifications/unread-count every 30 seconds
// Updates the notification bell badge
// When count increases, refetch notification list
```

Components to update:
- `src/components/notification-bell.tsx` — use polling instead of Realtime
- `src/components/notification-dropdown.tsx` — use polling

**3. Remove Supabase Realtime dependency**

- Delete `src/lib/notifications/realtime.ts`
- Remove `subscribeToNotifications` from `src/lib/notifications/index.ts`
- Remove Realtime subscription from notification components

**4. Vercel Cron for email summaries**

Create `src/app/api/cron/notifications/route.ts`:

```typescript
// GET /api/cron/notifications — called by Vercel Cron every 3 days
// 1. Find users with unread notifications + dailySummary preference
// 2. Group notifications by type
// 3. Generate HTML email summary
// 4. Send via Resend
// 5. Log to NotificationLog
```

Vercel Cron config in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/notifications",
    "schedule": "0 8 */3 * *"
  }]
}
```

**5. Notification creation flow (updated)**

```
Event occurs (comment, like, etc.)
  → createNotification() creates Notification record
  → createNotificationJob() creates NotificationJob with status="pending"
  → Background: processNotificationJobs() picks up pending jobs
  → For in_app: mark as sent immediately (notification is already in DB)
  → For email: send via Resend, update job status
```

**6. Retry strategy**

- `NotificationJob.attempts` tracks retry count
- `processNotificationJobs()` picks up jobs where `status = 'pending'` AND `scheduledFor <= now()`
- On failure: increment `attempts`, set `lastError`, reschedule with exponential backoff
- After `maxAttempts` (3): set `status = 'failed'`, log error

**7. Deduplication strategy**

- Check for existing unread notification with same `(userId, type)` within last 5 minutes
- If found, update the existing notification's `message` and `data` instead of creating a new one
- This prevents duplicate milestone notifications

### Files Likely Affected

- `prisma/schema.prisma` — NotificationJob model, Notification.jobs relation
- `src/lib/notification-helpers.ts` — add deduplication, create NotificationJob
- `src/lib/notifications/index.ts` — remove Realtime export
- `src/lib/notifications/realtime.ts` — DELETE this file
- `src/lib/notifications/email-service.ts` — add new templates
- `src/lib/notifications/scheduler.ts` — DELETE (replaced by Vercel Cron)
- New: `src/app/api/cron/notifications/route.ts`
- New: `src/hooks/use-notification-polling.ts`
- New: `prisma/migrations/XXXX_add_notification_jobs/`
- `src/components/notification-bell.tsx` — use polling hook
- `src/components/notification-dropdown.tsx` — use polling hook
- `vercel.json` — add cron config

### Edge Cases

- **User has no NotificationPreference:** Use defaults (emailEnabled: true, dailySummary: true)
- **Resend API fails:** Job retries up to 3 times with exponential backoff
- **Cron runs twice (Vercel may invoke twice):** NotificationJob status check prevents duplicate processing
- **High notification volume:** NotificationJob queue prevents flooding. Process in batches of 50.

### Security Considerations

- **Notification content is user-controlled (via data field):** Sanitize before rendering in email templates
- **Cron endpoint should be protected:** Only Vercel Cron can call it. Use `CRON_SECRET` env var for verification.
- **Email rate limiting:** Resend has rate limits. The queue handles this gracefully.

### Required Tests

1. **Create notification:** Verify Notification record created
2. **Create notification with deduplication:** Second notification within 5 min updates existing
3. **NotificationJob creation:** Verify job created with status="pending"
4. **Process notification jobs:** Mock Resend, verify job status updates to "sent"
5. **Retry on failure:** Mock Resend failure, verify retry with backoff
6. **Email summary generation:** Verify HTML template renders correctly
7. **Cron endpoint:** Verify it processes pending jobs and sends emails
8. **Unread count polling:** Verify count updates without Realtime

### Risks

- **Polling latency:** 30-second polling means notifications appear up to 30s late. Acceptable for this use case.
- **Vercel Cron limits:** Vercel free tier allows 1 cron job. Paid plans allow more. Ensure plan supports the cron schedule.
- **NotificationJob table growth:** Add cleanup job to delete old processed jobs (keep 30 days).

---

## Phase 5: Report Workflow Improvement

### Goal
Add report status history, validate status transitions, ensure proper notifications to reporters and content owners, and complete audit logging.

### Database Changes

**New model: `ReportStatusHistory`**

```prisma
model ReportStatusHistory {
  id         String   @id @default(cuid())
  reportId   String
  report     Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  fromStatus String?
  toStatus   String
  action     String?  // the action taken (warned, content_hidden, etc.)
  resolution String?
  actorId    String?
  actor      User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  createdAt  DateTime @default(now())

  @@index([reportId])
  @@index([createdAt])
}
```

### Valid Status Transitions

```
new → under_review
new → confirmed
new → rejected
new → resolved

under_review → confirmed
under_review → rejected
under_review → reopened
under_review → resolved

reopened → under_review
reopened → confirmed
reopened → rejected
reopened → resolved

confirmed → resolved
rejected → reopened
```

**Invalid transitions (should return 400):**
- `resolved → *` (terminal state)
- `confirmed → reopened` (must go through under_review)
- `rejected → confirmed` (must go through reopened)

### API Changes

**1. Update `src/app/api/admin/reports/[id]/confirm/route.ts`**

- Validate current status is `new`, `under_review`, or `reopened`
- Create `ReportStatusHistory` record
- Notify reporter via in-app notification + email
- Notify content owner via in-app notification + email
- Audit log entry

**2. Update `src/app/api/admin/reports/[id]/reject/route.ts`**

- Validate current status is `new`, `under_review`, or `reopened`
- Create `ReportStatusHistory` record
- Notify reporter via in-app notification + email
- Audit log entry

**3. Update `src/app/api/admin/reports/[id]/route.ts` (PATCH)**

- Validate status transition is allowed
- Create `ReportStatusHistory` record
- If assigning: create history entry with `action: 'assigned'`
- Audit log entry

**4. New endpoint: `src/app/api/admin/reports/[id]/history/route.ts`**

GET — Return status history for a report.

### UI Changes

**Report detail page (`src/app/admin/reports/[id]/`):**
- Show status history timeline
- Show actor who made each change
- Show timestamps

### Files Likely Affected

- `prisma/schema.prisma` — ReportStatusHistory model, Report.statusHistory relation
- `src/app/api/admin/reports/[id]/confirm/route.ts` — add history, notifications
- `src/app/api/admin/reports/[id]/reject/route.ts` — add history, notifications
- `src/app/api/admin/reports/[id]/route.ts` — validate transitions, add history
- New: `src/app/api/admin/reports/[id]/history/route.ts`
- New: `prisma/migrations/XXXX_add_report_status_history/`
- `src/lib/reports/constants.ts` — add valid transitions map

### Edge Cases

- **Concurrent status changes:** Two moderators try to confirm the same report. The second one gets a "status already changed" error because the first one changed the status.
- **Self-assignment:** A moderator can assign a report to themselves. No restriction needed.
- **History for initial creation:** When a report is created, add a history entry with `fromStatus: null, toStatus: 'new'`.

### Security Considerations

- **Only moderators+ can change report status:** Already enforced by `requireModerator()`
- **Status transition validation prevents privilege escalation:** Cannot skip directly from `new` to `resolved` without going through review
- **Audit trail is immutable:** `ReportStatusHistory` records are never deleted or updated

### Required Tests

1. **Valid transition — new to confirmed:** Confirm a new report, verify history entry created
2. **Valid transition — new to rejected:** Reject a new report, verify history
3. **Invalid transition — confirmed to reopened:** Attempt, expect 400 error
4. **Invalid transition — resolved to anything:** Attempt, expect 400 error
5. **Reporter notification on confirm:** Verify reporter receives in-app notification
6. **Reporter notification on reject:** Verify reporter receives in-app notification
7. **Content owner notification on confirm:** Verify target user receives notification
8. **History retrieval:** GET history endpoint returns correct timeline
9. **Audit logging:** Verify AuditLog entry created for each status change

### Risks

- **History table growth:** One entry per status change. Acceptable volume.
- **Backward compatibility:** Existing reports with no history entries. The UI should handle "no history" gracefully.

---

## Implementation Order

Execute phases in this order:

1. **Phase 1 (Identity)** — CRITICAL security fix. Do first.
2. **Phase 2 (Roles)** — Foundation for permission changes in other phases.
3. **Phase 5 (Reports)** — Smaller scope, builds on Phase 2.
4. **Phase 3 (Sections + Downloads)** — New features, depends on Phase 2.
5. **Phase 4 (Notifications)** — Largest scope, can be done last.

Within each phase, follow TDD: write tests first, then implement, then verify.

---

## Summary of All New Models

| Model | Purpose | Phase |
|-------|---------|-------|
| `OAuthAccount` | Multi-provider OAuth linking | 1 |
| `Section` | 7 main content sections | 3 |
| `DownloadClick` | Download tracking | 3 |
| `NotificationJob` | Reliable notification delivery | 4 |
| `ReportStatusHistory` | Report status audit trail | 5 |

## Summary of All New Endpoints

| Endpoint | Method | Phase | Auth |
|----------|--------|-------|------|
| `/api/settings/linked-accounts` | GET | 1 | requireAuth |
| `/api/settings/link-account` | POST | 1 | requireAuth |
| `/api/settings/unlink-account` | POST | 1 | requireAuth |
| `/api/sections` | GET | 3 | public |
| `/api/admin/sections` | POST | 3 | requireManager |
| `/api/admin/sections/[id]` | PUT/DELETE | 3 | requireManager |
| `/api/mods/[slug]/download/[linkId]` | GET | 3 | public |
| `/api/cron/notifications` | GET | 4 | CRON_SECRET |
| `/api/admin/reports/[id]/history` | GET | 5 | requireModerator |
