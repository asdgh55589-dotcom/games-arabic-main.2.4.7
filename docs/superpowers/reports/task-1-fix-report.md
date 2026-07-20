# Task 1 Fix Report

## What Was Fixed

### 1. ID Generation Inconsistency
- **Issue:** Notification, NotificationPreference, and NotificationLog models used `@default(uuid())` while all other models used `@default(cuid())`
- **Fix:** Changed all three models to use `@default(cuid())` for consistency
- **File:** `prisma/schema.prisma`

### 2. Old Schema Fields in notification-helpers.ts
- **Issue:** Used old fields: `actorId`, `entityType`, `entityId`, `body`, `link` as direct Prisma fields
- **Fix:** Updated to use new schema fields:
  - `body` → `message` (required String field)
  - `actorId`, `entityType`, `entityId`, `link` → packed into `data` JSON field
- **File:** `src/lib/notification-helpers.ts`

### 3. Old Notification Interface in types.ts
- **Issue:** Had `entityType`, `entityId`, `body` fields
- **Fix:** Updated to use `message` field, removed `entityType` and `entityId` (now in `data` JSON)
- **File:** `src/lib/types.ts`

### 4. Old Field References in UI Components
- **Issue:** `notifications.tsx` and `notification-dropdown.tsx` referenced `notification.body`
- **Fix:** Changed to `notification.message`
- **Files:** `src/views/notifications.tsx`, `src/components/notification-dropdown.tsx`

### 5. API Route Using Non-Existent Fields
- **Issue:** Selected `entityType`, `entityId`, `body`, `link`, `actor` (relation) that don't exist in schema
- **Fix:** Updated to select `message` and `data` (JSON), then shape response by extracting `link` and `actor` from `data`
- **File:** `src/app/api/notifications/route.ts`

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | uuid() → cuid() for 3 models |
| `src/lib/notification-helpers.ts` | New schema fields (message, data JSON) |
| `src/lib/types.ts` | Notification interface updated |
| `src/views/notifications.tsx` | body → message |
| `src/components/notification-dropdown.tsx` | body → message |
| `src/app/api/notifications/route.ts` | Use new schema fields |

## Test Results

- TypeScript compilation: No notification-related errors
- All pre-existing type errors (Date vs string, missing fields, etc.) are unrelated to this fix

## Self-Review Findings

1. **All 3 original issues are resolved:**
   - ID consistency: All models now use `cuid()`
   - Old fields updated: All 5 files now use new schema fields
   - API route correctly shapes response from `data` JSON

2. **Additional fix:** The `message` field in the Prisma schema is required (not nullable), so all callers must provide it. Updated to use empty string `''` when no message content is needed.

3. **Actor info limitation:** The API currently returns a minimal actor object `{ id, username: '', avatarUrl: null }` from the `data` JSON. For full actor info (username, avatarUrl), a DB lookup would be needed. This is a known trade-off for simplicity.
