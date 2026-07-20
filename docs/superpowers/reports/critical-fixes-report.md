# Critical Fixes Report

## Summary

Fixed all 5 critical issues identified in the final code review.

## Fixes Applied

### 1. `isRead` field never updated (commit `0bfc59a`)

**Problem:** API read endpoints only set `readAt: new Date()`, never `isRead: true`.

**Files changed:**
- `src/app/api/notifications/[id]/read/route.ts` — added `isRead: true` to update data
- `src/app/api/notifications/read-all/route.ts` — added `isRead: true` to updateMany data

### 2. API response shape mismatch (commit `c53bd70`)

**Problem:** The view expects `data.totalPages` and `data.unreadCount`, but the API returned `{ pagination: { pages } }`.

**Files changed:**
- `src/app/api/notifications/route.ts` — changed response to `{ notifications, totalPages, unreadCount }` at top level; added `unreadCount` query

### 3. `SUPABASE_SERVICE_ROLE_KEY` exposed to client (commit `67204c0`)

**Problem:** `realtime.ts` created a module-scope Supabase client with service role key, but was imported by client components.

**Files changed:**
- `src/lib/notifications/realtime.ts` — replaced module-scope client with lazy-initialized clients: `getBrowserClient()` (anon key via `@supabase/ssr`) for client-side subscriptions, `getServerClient()` (service role key) for server-side broadcast

### 4. Duplicate dead-code components (commit `ec74d02`)

**Problem:** Two sets of notification UI existed. Live components are in `src/components/`, dead code was in `src/components/notifications/`.

**Files deleted:**
- `src/components/notifications/NotificationBell.tsx`
- `src/components/notifications/NotificationDropdown.tsx`
- `src/components/notifications/NotificationItem.tsx`
- `src/components/notifications/NotificationFilters.tsx`
- `src/app/notifications/page.tsx` (imported dead code, superseded by `src/views/notifications.tsx`)

### 5. Missing `@heroicons/react` dependency (commit `718889e`)

**Problem:** Package was not in `package.json`.

**Files changed:**
- `package.json` — added `@heroicons/react: ^2.2.0`
- `package-lock.json` — updated lock file

## Test Results

All 7 existing tests pass (1 suite, 7 tests). No regressions.

## Verification

- Lint: No new errors from changed files (pre-existing `@/` path alias errors only)
- Typecheck: No new type errors from changes
- Git log confirms 5 clean, separate commits
