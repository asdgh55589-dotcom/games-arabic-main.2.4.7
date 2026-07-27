# Notification System Redesign

## Overview

Fix existing bugs in the notification system, then redesign the architecture for long-term maintainability. Two-phase approach: Phase 1 (bug fixes) then Phase 2 (architecture redesign).

## Current State

- **14 issues** identified across database, API, frontend, and email service
- Supabase Realtime partially implemented but never subscribed to on client
- Notification types are raw strings scattered across files
- `actor` and `link` fields missing from API responses
- Duplicate endpoints, redundant fields, security issues

---

## Phase 1: Bug Fixes

### 1.1 Fix unread filter bug

**Problem:** View sends `unread=true` but API expects `read=false`. Filter silently broken.

**Fix:**
- `GET /api/notifications` — use `read` query param (not `unread`)
- `src/views/notifications.tsx` — send `read=false` instead of `unread=true`
- Keep `GET /api/notifications/unread` as-is (already works)

### 1.2 Fix API responses — add `actor` and `link`

**Problem:** Frontend `Notification` type expects `actor: NotificationActor | null` and `link: string | null`, but API never returns them.

**Fix:**
- In `GET /api/notifications` and `GET /api/notifications/unread`, add `data` to Prisma `select`
- Extract `actor` from `data.actor` and `link` from `data.link` in response
- Return `{ ...notification, actor: data.actor || null, link: data.link || null }`

### 1.3 Remove duplicate endpoint

**Problem:** `GET /api/notifications/count` is identical to `GET /api/notifications/unread-count`.

**Fix:** Delete `src/app/api/notifications/count/route.ts`.

### 1.4 Fix PATCH security

**Problem:** `PATCH /api/notifications/[id]` lets users change `type` and `title` of their own notifications.

**Fix:**
- Remove PATCH from `src/app/api/notifications/[id]/route.ts` (user-facing)
- Add `PATCH /api/admin/notifications/[id]/route.ts` (admin-only, requires moderator+ role)

### 1.5 Add bulk delete

**Problem:** No way to delete multiple notifications at once.

**Fix:**
- New route: `DELETE /api/notifications/bulk`
- Accepts `{ ids: string[] }` in request body
- Validates all IDs belong to the requesting user
- Deletes all matching notifications in a transaction

### 1.6 Fix daily summary type names

**Problem:** `email-service.ts` groups by `'like'`, `'comment'`, `'admin'`, `'system'` but actual types are `'mod_endorse'`, `'comment_reply'`, `'admin_action'`, etc.

**Fix:** Update group-by keys in `generateDailySummary()` to match actual notification types.

---

## Phase 2: Architecture Redesign

### 2.1 Centralized NotificationType enum

**New file:** `src/lib/notifications/types.ts`

```typescript
export enum NotificationType {
  CommentReply = 'comment_reply',
  Like = 'like',
  ModEndorse = 'mod_endorse',
  ModEndorseMilestone = 'mod_endorse_milestone',
  ModFeatured = 'mod_featured',
  TierUpgrade = 'tier_upgrade',
  SpecialRoleAssigned = 'special_role_assigned',
  SpecialRoleRemoved = 'special_role_removed',
  AdminAction = 'admin_action',
  AdminUserRegister = 'admin_user_register',
  AdminRequest = 'admin_request',
  AdminReport = 'admin_report',
  AdminMilestone = 'admin_milestone',
}
```

- All handlers import from this single source
- API whitelist uses enum values
- Replaces raw strings scattered across files

### 2.2 Add `actorId` field to Notification model

**Schema change:**
```prisma
model Notification {
  ...
  actorId String? @map("actor_id")
  actor   User?   @relation(fields: [actorId], references: [id], onDelete: SetNull)
}
```

- Replace `data.actor` with proper foreign key relation
- API queries: `include: { actor: { select: { id, username, avatarUrl } } }`
- Migration: backfill `actorId` from existing `data.actor.id` values

### 2.3 Unified creation pipeline

Single function `createNotification()` handles all cases:

```typescript
function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  actorId?: string
  data?: Record<string, any>
}): Promise<Notification>
```

Responsibilities:
1. Write to database
2. Send Supabase Realtime broadcast
3. Log to NotificationLog (creation event)

All handlers (`notifyCommentReply`, `notifyModEndorseMilestone`, `notifyModFeatured`, `notifyAdminAction`, etc.) call this single function.

### 2.4 Wire Supabase Realtime on client

**In `notification-bell.tsx`:**
- Call `subscribeToNotifications(userId, callback)` on mount
- Callback: add new notification to state, increment unread count
- Remove 30-second polling `setInterval`
- Cleanup subscription on unmount

**In `notification-dropdown.tsx`:**
- Same subscription for live updates in dropdown

### 2.5 NotificationLog improvements

- Log every notification creation (not just email delivery)
- Track events: `created`, `realtime_sent`, `email_sent`
- Add `NotificationLogEvent` enum for type safety

---

## Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `src/app/api/notifications/route.ts` | 1 | Fix `read` param, add `data` to select, extract actor/link |
| `src/app/api/notifications/unread/route.ts` | 1 | Add `data` to select, extract actor/link |
| `src/app/api/notifications/[id]/route.ts` | 1 | Remove PATCH |
| `src/app/api/notifications/count/route.ts` | 1 | Delete file |
| `src/app/api/notifications/bulk/route.ts` | 1 | New file — bulk delete |
| `src/views/notifications.tsx` | 1 | Fix unread filter param |
| `src/lib/notifications/email-service.ts` | 1 | Fix type names in summary |
| `src/lib/notifications/types.ts` | 2 | New file — NotificationType enum |
| `src/lib/notification-helpers.ts` | 2 | Refactor to use enum + unified pipeline |
| `src/lib/notifications/realtime.ts` | 2 | Update for new actor model |
| `src/lib/notifications/handlers/*.ts` | 2 | Use enum, pass actorId |
| `src/components/notification-bell.tsx` | 2 | Wire Supabase Realtime, remove polling |
| `src/components/notification-dropdown.tsx` | 2 | Wire Supabase Realtime |
| `prisma/schema.prisma` | 2 | Add `actorId` field |
| `prisma/migrations/` | 2 | Migration for `actorId` + backfill |

## Migration Strategy

1. Phase 1: No schema changes — pure code fixes
2. Phase 2: Single migration adding `actorId` column, backfilling from `data.actor.id`, then dropping `data.actor`
   - Backfill: `UPDATE notifications SET actor_id = data->'actor'->>'id' WHERE data->'actor'->>'id' IS NOT NULL`
   - Skip entries where `data.actor` is malformed or missing `id`; log warning

## Testing

- Unit tests for `createNotification()` pipeline
- Unit tests for notification type enum usage
- Integration tests for bulk delete endpoint
- Manual test: verify Realtime delivers notifications instantly
- Manual test: verify daily summary groups by correct types
