# High Severity Bugs Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 11 high-severity bugs in the admin dashboard: AuthError handling, memory leaks, notifications-health PrismaClient, session invalidation on user delete, body.files data source, parseInt NaN handling, ownerId permission check, IP ban deletion error handling, loading states, JWT expiry, and form validation.

**Architecture:** Eleven independent tasks that can be executed in any order. Each task modifies different files with minimal cross-dependencies. Tasks are ordered by impact and complexity.

**Tech Stack:** Next.js 16 (Edge runtime for middleware), TypeScript 5, Prisma 6, jose (JWT), Redis (Upstash), React 19

## Global Constraints

- Runtime: Next.js 16 App Router with Edge runtime for middleware
- Language: TypeScript 5 with `strict: true`, `noImplicitAny: false`
- Path alias: `@/*` → `./src/*`
- Auth: Supabase Auth + JWT role cookie (`ga_admin_role`)
- Database: Prisma 6 + PostgreSQL (Neon)
- Redis: Upstash (for rate limiting + IP ban cache)
- Package manager: bun
- Build command: `bun run build`
- Lint command: `bun run lint`
- Test command: `npx jest`

---

## File Structure

### Files to Create
- `src/lib/api-error-handler.ts` — Helper for handling AuthError in API routes
- `src/hooks/useAbortController.ts` — Custom hook for AbortController

### Files to Modify
- `src/app/api/admin/*/route.ts` — 51 files (AuthError handling)
- `src/app/api/admin/notifications-health/route.ts` — Fix PrismaClient
- `src/app/api/admin/users/[id]/route.ts` — Add session invalidation on delete
- `src/app/api/admin/mods/route.ts` — Fix body.files data source
- `src/app/api/admin/mods/[id]/route.ts` — Fix body.files data source
- `src/app/api/admin/teams/[id]/route.ts` — Fix ownerId permission check
- `src/app/api/admin/users/[id]/ban/route.ts` — Fix IP ban deletion error
- `src/app/api/admin/activity-log/route.ts` — Fix parseInt NaN
- `src/app/api/admin/tier-history/route.ts` — Fix parseInt NaN
- `src/app/api/admin/tier-rules/[tier]/route.ts` — Fix parseInt NaN
- `src/app/api/admin/users/analytics/inactive/route.ts` — Fix parseInt NaN
- `src/app/api/admin/audit/route.ts` — Fix parseInt NaN
- `src/app/api/admin/reports/route.ts` — Fix parseInt NaN
- `src/app/api/admin/endorsements/route.ts` — Fix parseInt NaN
- `src/app/admin/*/page.tsx` — 28 files (AbortController)
- `src/components/admin/*.tsx` — 7 files (AbortController)
- `src/components/admin/users/add-user-modal.tsx` — Form validation
- `src/components/admin/users/ban-modal.tsx` — Loading state
- `src/components/admin/users/password-modal.tsx` — Loading state
- `src/app/admin/users/[id]/page.tsx` — Loading state
- `src/lib/auth.ts` — JWT expiry reduction

---

## Task 1: Create AuthError Handler Helper

**Files:**
- Create: `src/lib/api-error-handler.ts`
- Test: `src/__tests__/api-error-handler.test.ts`

**Interfaces:**
- Consumes: `AuthError` from `@/lib/auth`
- Produces: `handleApiError(err, context)` function

- [ ] **Step 1: Create the helper file**

Create `src/lib/api-error-handler.ts`:

```typescript
import { AuthError } from '@/lib/auth'
import { unauthorized, forbidden, internalError } from '@/lib/api-response'
import { NextResponse } from 'next/server'

/**
 * Handle API errors consistently across all admin routes.
 * Returns proper HTTP status for AuthError, 500 for other errors.
 */
export function handleApiError(err: unknown, context: string): NextResponse {
  if (err instanceof AuthError) {
    console.error(`[${context}] auth error:`, err.message)
    return err.status === 401 ? unauthorized(err.message) : forbidden(err.message)
  }
  console.error(`[${context}] failed:`, err)
  return internalError('Failed')
}
```

- [ ] **Step 2: Create test file**

Create `src/__tests__/api-error-handler.test.ts`:

```typescript
import { handleApiError } from '@/lib/api-error-handler'
import { AuthError } from '@/lib/auth'

describe('handleApiError', () => {
  it('should return 401 for AuthError with status 401', () => {
    const err = new AuthError('Unauthorized', 401)
    const response = handleApiError(err, 'test')
    expect(response.status).toBe(401)
  })

  it('should return 403 for AuthError with status 403', () => {
    const err = new AuthError('Forbidden', 403)
    const response = handleApiError(err, 'test')
    expect(response.status).toBe(403)
  })

  it('should return 500 for other errors', () => {
    const err = new Error('Something went wrong')
    const response = handleApiError(err, 'test')
    expect(response.status).toBe(500)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/api-error-handler.test.ts --no-cache`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-error-handler.ts src/__tests__/api-error-handler.test.ts
git commit -m "feat(api): add handleApiError helper for consistent AuthError handling"
```

---

## Task 2: Fix AuthError Handling in All Admin APIs

**Files:**
- Modify: 51 files in `src/app/api/admin/`
- Test: Manual verification

**Interfaces:**
- Consumes: `handleApiError` from `@/lib/api-error-handler`
- Produces: Updated catch blocks in all admin API routes

- [ ] **Step 1: Update each file to use handleApiError**

For each file in `src/app/api/admin/`, replace the catch block pattern:

```typescript
// BEFORE:
} catch (err) {
  console.error('[admin/...] failed:', err)
  return internalError('Failed')
}

// AFTER:
} catch (err) {
  return handleApiError(err, 'admin/...')
}
```

**Files to update (51 files):**

| # | File | Context String |
|---|------|----------------|
| 1 | `activity-log/route.ts` | `admin/activity-log GET` |
| 2 | `audit/route.ts` | `admin/audit GET` |
| 3 | `comments/route.ts` | `admin/comments GET/DELETE` |
| 4 | `comments/[id]/route.ts` | `admin/comments/[id] GET/DELETE` |
| 5 | `dashboard/route.ts` | `admin/dashboard GET` |
| 6 | `endorsements/route.ts` | `admin/endorsements GET` |
| 7 | `games/route.ts` | `admin/games GET/POST` |
| 8 | `games/[id]/route.ts` | `admin/games/[id] GET/PUT/DELETE` |
| 9 | `maintenance/route.ts` | `admin/maintenance GET/PUT` |
| 10 | `mods/bulk/route.ts` | `admin/mods/bulk PUT/DELETE` |
| 11 | `mods/route.ts` | `admin/mods GET/POST` |
| 12 | `mods/[id]/route.ts` | `admin/mods/[id] GET/PUT/DELETE` |
| 13 | `notifications/[id]/route.ts` | `admin/notifications/[id] DELETE` |
| 14 | `notifications-health/route.ts` | `admin/notifications-health GET` |
| 15 | `reports/route.ts` | `admin/reports GET` |
| 16 | `reports/[id]/route.ts` | `admin/reports/[id] GET/PUT` |
| 17 | `reports/[id]/history/route.ts` | `admin/reports/[id]/history GET` |
| 18 | `reports/[id]/confirm/route.ts` | `admin/reports/[id]/confirm POST` |
| 19 | `reports/[id]/reject/route.ts` | `admin/reports/[id]/reject POST` |
| 20 | `reports/export/route.ts` | `admin/reports/export GET` |
| 21 | `reports/stats/route.ts` | `admin/reports/stats GET` |
| 22 | `sections/route.ts` | `admin/sections GET/POST` |
| 23 | `sections/[id]/route.ts` | `admin/sections/[id] GET/PUT/DELETE` |
| 24 | `series/route.ts` | `admin/series GET/POST` |
| 25 | `series/[id]/route.ts` | `admin/series/[id] GET/PUT/DELETE` |
| 26 | `settings/route.ts` | `admin/settings GET/PUT` |
| 27 | `special-roles/route.ts` | `admin/special-roles GET/POST` |
| 28 | `special-roles/[key]/route.ts` | `admin/special-roles/[key] GET/PUT/DELETE` |
| 29 | `setup/route.ts` | `admin/setup POST` |
| 30 | `teams/route.ts` | `admin/teams GET/POST` |
| 31 | `teams/[id]/route.ts` | `admin/teams/[id] GET/PUT/DELETE` |
| 32 | `teams/[id]/mods/route.ts` | `admin/teams/[id]/mods GET` |
| 33 | `teams/[id]/members/route.ts` | `admin/teams/[id]/members GET/POST/DELETE` |
| 34 | `templates/route.ts` | `admin/templates GET/POST` |
| 35 | `templates/[id]/route.ts` | `admin/templates/[id] GET/PUT/DELETE` |
| 36 | `templates/[id]/preview/route.ts` | `admin/templates/[id]/preview GET` |
| 37 | `tier-history/route.ts` | `admin/tier-history GET` |
| 38 | `tier-rules/route.ts` | `admin/tier-rules GET/POST` |
| 39 | `tier-rules/[tier]/route.ts` | `admin/tier-rules/[tier] GET/PUT/DELETE` |
| 40 | `users/route.ts` | `admin/users GET/POST` |
| 41 | `users/[id]/route.ts` | `admin/users/[id] GET/PUT/DELETE` |
| 42 | `users/[id]/ban/route.ts` | `admin/users/[id]/ban POST/DELETE` |
| 43 | `users/[id]/unban/route.ts` | `admin/users/[id]/unban POST` |
| 44 | `users/[id]/warn/route.ts` | `admin/users/[id]/warn POST` |
| 45 | `users/[id]/tier/route.ts` | `admin/users/[id]/tier GET/PUT` |
| 46 | `users/[id]/tier/revoke/route.ts` | `admin/users/[id]/tier/revoke POST` |
| 47 | `users/[id]/tier-history/route.ts` | `admin/users/[id]/tier-history GET` |
| 48 | `users/[id]/special-role/route.ts` | `admin/users/[id]/special-role PUT` |
| 49 | `users/export/route.ts` | `admin/users/export GET` |
| 50 | `users/analytics/summary/route.ts` | `admin/users/analytics/summary GET` |
| 51 | `users/analytics/trends/route.ts` | `admin/users/analytics/trends GET` |
| 52 | `users/analytics/inactive/route.ts` | `admin/users/analytics/inactive GET` |
| 53 | `users/inactive/alert/route.ts` | `admin/users/inactive/alert POST` |
| 54 | `news/route.ts` | `admin/news GET/POST` |
| 55 | `news/[id]/route.ts` | `admin/news/[id] GET/PUT/DELETE` |
| 56 | `ads/route.ts` | `admin/ads GET/POST` |
| 57 | `ads/[id]/route.ts` | `admin/ads/[id] GET/PUT/DELETE` |

- [ ] **Step 2: Add import to each file**

Add at the top of each file:
```typescript
import { handleApiError } from '@/lib/api-error-handler'
```

- [ ] **Step 3: Run build to verify**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/
git commit -m "fix(api): use handleApiError for consistent AuthError handling in 51 admin routes

- All admin API routes now return 401/403 for AuthError instead of 500
- Created handleApiError helper for consistent error handling"
```

---

## Task 3: Fix notifications-health PrismaClient

**Files:**
- Modify: `src/app/api/admin/notifications-health/route.ts`
- Test: Manual verification

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces: Updated route using shared PrismaClient

- [ ] **Step 1: Update the file**

```typescript
// BEFORE:
import { requireManager } from '@/lib/auth'
import { metricsService } from '@/infrastructure/observability/metrics'
import { PrismaClient } from '@prisma/client'
import { ok, internalError } from '@/lib/api-response'

const db = new PrismaClient()

// AFTER:
import { requireManager } from '@/lib/auth'
import { metricsService } from '@/infrastructure/observability/metrics'
import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'
```

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/notifications-health/route.ts
git commit -m "fix(api): use shared PrismaClient in notifications-health route"
```

---

## Task 4: Add Session Invalidation on User Deletion

**Files:**
- Modify: `src/app/api/admin/users/[id]/route.ts:125-148`
- Test: Manual verification

**Interfaces:**
- Consumes: `invalidateUserSessions` from `@/lib/auth`
- Produces: Session invalidation before user deletion

- [ ] **Step 1: Add invalidateUserSessions before delete**

```typescript
// BEFORE (line 143):
await db.user.delete({ where: { id } })
return ok({ success: true })

// AFTER:
await invalidateUserSessions(id)
await db.user.delete({ where: { id } })
return ok({ success: true })
```

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/[id]/route.ts
git commit -m "fix(auth): invalidate sessions before deleting user"
```

---

## Task 5: Fix body.files Data Source in Mods API

**Files:**
- Modify: `src/app/api/admin/mods/route.ts:161-163`
- Modify: `src/app/api/admin/mods/[id]/route.ts:111-114`
- Test: Manual verification

**Interfaces:**
- Consumes: `parsed.data` from Zod validation
- Produces: Uses validated data instead of raw body

- [ ] **Step 1: Fix mods/route.ts**

```typescript
// BEFORE (lines 161-163):
if (Array.isArray(body.files)) {
  for (let i = 0; i < body.files.length; i++) {
    const f = body.files[i]

// AFTER:
if (Array.isArray(parsed.data.files)) {
  for (let i = 0; i < parsed.data.files.length; i++) {
    const f = parsed.data.files[i]
```

- [ ] **Step 2: Fix mods/[id]/route.ts**

Read the file first to understand the context, then replace `body.files` with validated data.

- [ ] **Step 3: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/mods/route.ts src/app/api/admin/mods/[id]/route.ts
git commit -m "fix(api): use parsed.data instead of raw body for files in mods API"
```

---

## Task 6: Fix parseInt NaN Handling

**Files:**
- Modify: `src/app/api/admin/activity-log/route.ts:18-19`
- Modify: `src/app/api/admin/tier-history/route.ts:10-11`
- Modify: `src/app/api/admin/tier-rules/[tier]/route.ts:14,42`
- Modify: `src/app/api/admin/users/analytics/inactive/route.ts:11`
- Modify: `src/app/api/admin/audit/route.ts:11-12`
- Modify: `src/app/api/admin/reports/route.ts:11-12`
- Modify: `src/app/api/admin/endorsements/route.ts:11-12`
- Test: Manual verification

**Interfaces:**
- Consumes: `parseInt` from JavaScript
- Produces: Safe parseInt with NaN handling

- [ ] **Step 1: Create helper function**

Add to `src/lib/api-utils.ts` or create new file:

```typescript
/**
 * Safe parseInt with NaN handling.
 * Returns defaultValue if parsing fails.
 */
export function safeParseInt(value: string | null, defaultValue: number): number {
  if (value === null) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : Math.max(1, parsed)
}
```

- [ ] **Step 2: Update each file to use safeParseInt**

Replace `parseInt(...)` calls with `safeParseInt(...)`.

- [ ] **Step 3: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-utils.ts src/app/api/admin/activity-log/route.ts src/app/api/admin/tier-history/route.ts src/app/api/admin/tier-rules/[tier]/route.ts src/app/api/admin/users/analytics/inactive/route.ts src/app/api/admin/audit/route.ts src/app/api/admin/reports/route.ts src/app/api/admin/endorsements/route.ts
git commit -m "fix(api): add safeParseInt helper to prevent NaN in pagination"
```

---

## Task 7: Fix ownerId Permission Check in Teams

**Files:**
- Modify: `src/app/api/admin/teams/[id]/route.ts:65`
- Test: Manual verification

**Interfaces:**
- Consumes: `requireAuth` from `@/lib/auth`
- Produces: Permission check for ownerId changes

- [ ] **Step 1: Add permission check**

```typescript
// BEFORE (line 65):
if (body.ownerId !== undefined) data.ownerId = body.ownerId || null

// AFTER:
if (body.ownerId !== undefined) {
  // Only owner can change team ownership
  if (currentUser.role !== 'owner') {
    return forbidden('Only owners can change team ownership')
  }
  // Validate owner exists if provided
  if (body.ownerId) {
    const ownerExists = await db.user.findUnique({ where: { id: body.ownerId }, select: { id: true } })
    if (!ownerExists) {
      return validationFail({ ownerId: 'User not found' })
    }
  }
  data.ownerId = body.ownerId || null
}
```

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/teams/[id]/route.ts
git commit -m "fix(auth): restrict ownerId changes to owner role only"
```

---

## Task 8: Fix IP Ban Deletion Error Handling

**Files:**
- Modify: `src/app/api/admin/users/[id]/ban/route.ts:151`
- Test: Manual verification

**Interfaces:**
- Consumes: `db.ipBan.delete` from Prisma
- Produces: Proper error handling for P2025

- [ ] **Step 1: Add try-catch around delete**

```typescript
// BEFORE (line 151):
await db.ipBan.delete({ where: { ipAddress: ip } })

// AFTER:
try {
  await db.ipBan.delete({ where: { ipAddress: ip } })
} catch {
  // IP ban doesn't exist — ignore
}
```

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/[id]/ban/route.ts
git commit -m "fix(api): handle missing IP ban in delete operation"
```

---

## Task 9: Add Loading States to Buttons

**Files:**
- Modify: `src/components/admin/users/add-user-modal.tsx`
- Modify: `src/components/admin/users/ban-modal.tsx`
- Modify: `src/components/admin/users/password-modal.tsx`
- Modify: `src/app/admin/users/[id]/page.tsx`
- Test: Manual verification

**Interfaces:**
- Consumes: `useState` from React
- Produces: Loading states on buttons

- [ ] **Step 1: Update add-user-modal.tsx**

Add `loading` state and disable button during submission.

- [ ] **Step 2: Update ban-modal.tsx**

Add `loading` state and disable button during submission.

- [ ] **Step 3: Update password-modal.tsx**

Add `loading` state and disable button during submission.

- [ ] **Step 4: Update users/[id]/page.tsx**

Add `loading` state for ban/unban buttons.

- [ ] **Step 5: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/users/add-user-modal.tsx src/components/admin/users/ban-modal.tsx src/components/admin/users/password-modal.tsx src/app/admin/users/[id]/page.tsx
git commit -m "feat(ui): add loading states to admin buttons"
```

---

## Task 10: Reduce JWT Cookie Expiry

**Files:**
- Modify: `src/lib/auth.ts:43`
- Test: Manual verification

**Interfaces:**
- Consumes: `ROLE_COOKIE_DURATION` constant
- Produces: Reduced cookie expiry

- [ ] **Step 1: Update cookie duration**

```typescript
// BEFORE (line 43):
const ROLE_COOKIE_DURATION = 60 * 60 * 24 * 7 // 7 أيام بالثواني

// AFTER:
const ROLE_COOKIE_DURATION = 60 * 60 * 24 // يوم واحد بالثواني
```

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "fix(auth): reduce JWT cookie expiry from 7 days to 1 day"
```

---

## Task 11: Add Form Validation in AddUserModal

**Files:**
- Modify: `src/components/admin/users/add-user-modal.tsx`
- Test: Manual verification

**Interfaces:**
- Consumes: `zod` for validation
- Produces: Form validation before submission

- [ ] **Step 1: Add validation**

Add email format validation and password length validation before calling `onSubmit`.

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/users/add-user-modal.tsx
git commit -m "feat(ui): add form validation in AddUserModal"
```

---

## Verification Checklist

After completing all 11 tasks, run these commands to verify:

```bash
# Run all tests
npx jest

# Run lint
bun run lint

# Run build
bun run build

# Check for TypeScript errors
npx tsc --noEmit
```

Expected results:
- All tests pass
- No lint errors
- Build succeeds
- No TypeScript errors

---

## Success Criteria

- [ ] AuthError returns 401/403 instead of 500 in all admin APIs
- [ ] notifications-health uses shared PrismaClient
- [ ] User deletion invalidates sessions
- [ ] Mods API uses validated data instead of raw body
- [ ] parseInt handles NaN gracefully
- [ ] Team ownerId changes restricted to owner role
- [ ] IP ban deletion handles missing records
- [ ] Buttons have loading states
- [ ] JWT cookie expiry reduced to 1 day
- [ ] AddUserModal validates form data
