# Task List: Migrate Admin User API Routes

## Phase 1: Core User Routes
- [ ] Task 1: `src/app/api/admin/users/route.ts`
- [ ] Task 2: `src/app/api/admin/users/[id]/route.ts`
- [ ] Task 3: `src/app/api/admin/users/[id]/ban/route.ts`
- [ ] Task 4: `src/app/api/admin/users/[id]/unban/route.ts`
- [ ] Task 5: `src/app/api/admin/users/[id]/warn/route.ts`

## Phase 2: Role & Tier Routes
- [ ] Task 6: `src/app/api/admin/users/[id]/special-role/route.ts`
- [ ] Task 7: `src/app/api/admin/users/[id]/tier/route.ts`
- [ ] Task 8: `src/app/api/admin/users/[id]/tier/revoke/route.ts`
- [ ] Task 9: `src/app/api/admin/users/[id]/tier-history/route.ts`

## Phase 3: Export, Alerts, Analytics
- [ ] Task 10: `src/app/api/admin/users/export/route.ts`
- [ ] Task 11: `src/app/api/admin/users/inactive/alert/route.ts`
- [ ] Task 12: `src/app/api/admin/users/analytics/summary/route.ts`
- [ ] Task 13: `src/app/api/admin/users/analytics/trends/route.ts`
- [ ] Task 14: `src/app/api/admin/users/analytics/inactive/route.ts`

## Checkpoint
- [ ] `bun run build` passes
- [ ] `bun run lint` passes
