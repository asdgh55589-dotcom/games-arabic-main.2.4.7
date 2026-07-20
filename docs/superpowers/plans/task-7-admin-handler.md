# Task 7: بناء المعالج الإداري (Build Admin Handler)

## Goal
Create `src/lib/notifications/handlers/admin-handler.ts` that sends notifications to all admins for various events.

## Key Findings

1. **Codebase uses `db` from `@/lib/db`** — NOT `prisma` from `@/lib/prisma` as the task spec suggests. All 67 files in the codebase use `@/lib/db`. We follow the existing convention.
2. **Existing handler pattern** (all 3 handlers follow this):
   - Import `db` from `@/lib/db`
   - Import `sendRealtimeNotification` from `../realtime`
   - Query data, create notification via `db.notification.create()`, call `sendRealtimeNotification(userId)`
3. **User model has `role` field** (line 27 of schema.prisma): `role String @default("member") // member | moderator | admin | owner`
4. **Notification model** fields: id, userId, type (String), title, message, data (Json?), isRead, readAt, createdAt, updatedAt

## Plan

### Step 1: Create `src/lib/notifications/handlers/admin-handler.ts`

- Use `db` from `@/lib/db` (matching codebase convention)
- Import `sendRealtimeNotification` from `../realtime`
- Define `AdminNotificationType` union type: `'user_register' | 'request' | 'report' | 'milestone'`
- Define `AdminNotificationData` interface
- Implement `handleAdminNotification(type, data)`:
  1. Query all users where `role === 'admin'`
  2. Build message template based on type (Arabic templates)
  3. For each admin: create notification + send realtime

### Step 2: Update `src/lib/notifications/index.ts`

- Add export: `export { handleAdminNotification } from './handlers/admin-handler'`

### Step 3: Verify

- Run TypeScript type check to ensure no errors

### Step 4: Commit

### Step 5: Write report to `docs/superpowers/reports/task-7-report.md`
