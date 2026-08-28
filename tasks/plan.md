# Implementation Plan: Migrate Admin User API Routes to Standardized Response Format

## Overview
Migrate 14 admin user-related API route files to use the standardized `@/lib/api-response` helpers (`ok`, `okPaginated`, `forbidden`, `internalError`, `notFound`, `validationFail`) instead of raw `NextResponse.json()` calls.

## Transformation Rules
- `NextResponse.json({ users, total, page, ... })` → `okPaginated(users, { page, limit, total, totalPages })`
- `NextResponse.json({ user }, { status: 201 })` → `ok(user)`
- `NextResponse.json({ success: true })` → `ok({ success: true })`
- `NextResponse.json({ user, actions, comments })` → `ok({ user, actions, comments })`
- `NextResponse.json({ history })` → `ok({ history })`
- `NextResponse.json({ inactiveUsers })` → `ok({ inactiveUsers })`
- `NextResponse.json({ message: '...' })` → `ok({ message: '...' })`
- `NextResponse.json({ labels, newUsers, activeUsers })` → `ok({ labels, newUsers, activeUsers })`
- `NextResponse.json({ totalUsers, ... })` → `ok({ totalUsers, ... })`
- 400 errors → `validationFail({ message: '...' })`
- 403 errors → `forbidden('...')`
- 404 errors → `notFound('...')`
- 500 errors → `internalError('...')`
- Remove `NextResponse` from imports where no longer needed
- Add `import { ok, okPaginated, forbidden, internalError, notFound, validationFail } from '@/lib/api-response'`

## Notes
- Export route (file 10) returns raw `NextResponse` with custom headers for CSV/Excel — this is NOT a JSON response, so the import stays but only the error path changes
- Analytics summary route (file 12) doesn't import `NextRequest` — only imports `NextResponse`
- Business logic stays completely untouched

## Task List

### Phase 1: Core User Routes (5 files)
- [ ] Task 1: `src/app/api/admin/users/route.ts` — GET (paginated list) + POST (create user)
- [ ] Task 2: `src/app/api/admin/users/[id]/route.ts` — GET + PUT + DELETE
- [ ] Task 3: `src/app/api/admin/users/[id]/ban/route.ts` — POST + DELETE
- [ ] Task 4: `src/app/api/admin/users/[id]/unban/route.ts` — POST
- [ ] Task 5: `src/app/api/admin/users/[id]/warn/route.ts` — POST

### Phase 2: Role & Tier Routes (4 files)
- [ ] Task 6: `src/app/api/admin/users/[id]/special-role/route.ts` — POST + DELETE
- [ ] Task 7: `src/app/api/admin/users/[id]/tier/route.ts` — POST
- [ ] Task 8: `src/app/api/admin/users/[id]/tier/revoke/route.ts` — POST
- [ ] Task 9: `src/app/api/admin/users/[id]/tier-history/route.ts` — GET

### Phase 3: Export, Alerts, Analytics (5 files)
- [ ] Task 10: `src/app/api/admin/users/export/route.ts` — GET (error path only)
- [ ] Task 11: `src/app/api/admin/users/inactive/alert/route.ts` — POST
- [ ] Task 12: `src/app/api/admin/users/analytics/summary/route.ts` — GET
- [ ] Task 13: `src/app/api/admin/users/analytics/trends/route.ts` — GET
- [ ] Task 14: `src/app/api/admin/users/analytics/inactive/route.ts` — GET

### Checkpoint: Complete
- [ ] Run `bun run build` to verify no TypeScript errors
- [ ] Run `bun run lint` to check for issues
- [ ] Verify all 14 files have been modified

## Verification
- `bun run build` — ensures no TS/import errors
- `bun run lint` — ensures code style compliance
