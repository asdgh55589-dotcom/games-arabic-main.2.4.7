# Notification System Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 14 bugs in the notification system and redesign the architecture for long-term maintainability.

**Architecture:** Two-phase approach — Phase 1 fixes bugs in place (no schema changes), Phase 2 adds `actorId` field, centralized `NotificationType` enum, unified creation pipeline, and wires Supabase Realtime on client.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + PostgreSQL, Supabase Auth + Realtime, TypeScript 5

## Global Constraints
- RTL Arabic-first layout (`dir="rtl"`, `lang="ar"`)
- Edge runtime middleware — cannot import Prisma
- Supabase for auth, not for DB queries (Prisma handles DB)
- `jose` for JWT in middleware, `@/lib/ip-ban-cache` for Redis
- Path alias: `@/*` → `./src/*`
- ESLint: very permissive (`no-explicit-any: off`)
- TypeScript: `noImplicitAny: false`, `strict: true`

---

## Phase 1: Bug Fixes

### Task 1: Fix unread filter bug

**Files:**
- Modify: `src/app/api/notifications/route.ts:25-35`
- Modify: `src/views/notifications.tsx:40-45`

**Interfaces:**
- Consumes: None
- Produces: `GET /api/notifications?read=false` returns only unread notifications

- [ ] **Step 1: Read current API route**

Read `src/app/api/notifications/route.ts` lines 25-35 to find the filter logic.

- [ ] **Step 2: Fix API route to use `read` param**

In `src/app/api/notifications/route.ts`, change:
```typescript
// Before (broken):
if (read === 'true') where.readAt = { not: null }
if (read === 'false') where.readAt = null

// After (fixed):
const read = searchParams.get('read')
if (read === 'true') where.readAt = { not: null }
if (read === 'false') where.readAt = null
```
Ensure `read` is extracted from `searchParams` (it may already be — verify).

- [ ] **Step 3: Fix view to send `read=false`**

In `src/views/notifications.tsx`, find the filter logic and change:
```typescript
// Before (broken):
if (filter !== 'all') params.set('unread', 'true')

// After (fixed):
if (filter !== 'all') params.set('read', 'false')
```

- [ ] **Step 4: Test manually**

Run `bun run dev`, navigate to notifications, toggle "Unread" filter. Verify only unread notifications appear.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/route.ts src/views/notifications.tsx
git commit -m "fix: unread notification filter using correct query param"
```

---

### Task 2: Fix API responses — add actor and link

**Files:**
- Modify: `src/app/api/notifications/route.ts` (GET handler select)
- Modify: `src/app/api/notifications/unread/route.ts` (GET handler select)

**Interfaces:**
- Consumes: None
- Produces: API responses include `actor: { id, username, avatarUrl } | null` and `link: string | null`

- [ ] **Step 1: Read current GET handler**

Read `src/app/api/notifications/route.ts` GET handler to find the `select` statement.

- [ ] **Step 2: Add `data` to select and transform response**

In `src/app/api/notifications/route.ts` GET handler, update the select and mapping:
```typescript
// In the select, add data:
select: {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  data: true,  // ADD THIS
},

// After fetching, transform:
const notifications = rawNotifications.map((n) => ({
  ...n,
  actor: (n.data as any)?.actor || null,
  link: (n.data as any)?.link || null,
}))
```

- [ ] **Step 3: Apply same fix to unread route**

Read `src/app/api/notifications/unread/route.ts` and apply the same `data` select + transform.

- [ ] **Step 4: Test manually**

Run `bun run dev`, open notification dropdown. Verify avatars appear and clicking notifications navigates correctly.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/route.ts src/app/api/notifications/unread/route.ts
git commit -m "fix: include actor and link data in notification API responses"
```

---

### Task 3: Remove duplicate count endpoint

**Files:**
- Delete: `src/app/api/notifications/count/route.ts`

**Interfaces:**
- Consumes: None
- Produces: `/api/notifications/count` returns 404

- [ ] **Step 1: Verify unread-count exists**

Read `src/app/api/notifications/unread-count/route.ts` to confirm it works.

- [ ] **Step 2: Delete duplicate**

```bash
rm src/app/api/notifications/count/route.ts
rmdir src/app/api/notifications/count 2>/dev/null || true
```

- [ ] **Step 3: Verify no code imports from count**

Run: `grep -r "notifications/count" src/` — should find nothing.

- [ ] **Step 4: Commit**

```bash
git rm src/app/api/notifications/count/route.ts
git commit -m "chore: remove duplicate notifications/count endpoint"
```

---

### Task 4: Fix PATCH security

**Files:**
- Modify: `src/app/api/notifications/[id]/route.ts` (remove PATCH)
- Create: `src/app/api/admin/notifications/[id]/route.ts`

**Interfaces:**
- Consumes: None
- Produces: User PATCH removed, admin-only PATCH available

- [ ] **Step 1: Read current PATCH handler**

Read `src/app/api/notifications/[id]/route.ts` to find the PATCH export.

- [ ] **Step 2: Remove PATCH from user route**

Delete the `PATCH` export from `src/app/api/notifications/[id]/route.ts`. Keep GET and DELETE.

- [ ] **Step 3: Read admin middleware pattern**

Read `src/app/api/admin/reports/[id]/route.ts` to see how admin routes check roles.

- [ ] **Step 4: Create admin notification edit route**

Create `src/app/api/admin/notifications/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user || !['owner', 'admin', 'moderator'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const notification = await db.notification.update({
    where: { id },
    data: {
      ...(body.type && { type: body.type }),
      ...(body.title && { title: body.title }),
      ...(body.message && { message: body.message }),
    },
  })

  return NextResponse.json(notification)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/\[id\]/route.ts src/app/api/admin/notifications/\[id\]/route.ts
git commit -m "fix: move notification PATCH to admin-only endpoint"
```

---

### Task 5: Add bulk delete endpoint

**Files:**
- Create: `src/app/api/notifications/bulk/route.ts`

**Interfaces:**
- Consumes: None
- Produces: `DELETE /api/notifications/bulk` with `{ ids: string[] }` body

- [ ] **Step 1: Create bulk delete route**

Create `src/app/api/notifications/bulk/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function DELETE(request: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const deleted = await db.notification.deleteMany({
    where: {
      id: { in: ids },
      userId: user.id,
    },
  })

  return NextResponse.json({ deleted: deleted.count })
}
```

- [ ] **Step 2: Test manually**

Run `bun run dev`, open notifications, select multiple, delete. Verify they disappear.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/bulk/route.ts
git commit -m "feat: add bulk delete endpoint for notifications"
```

---

### Task 6: Fix daily summary type names

**Files:**
- Modify: `src/lib/notifications/email-service.ts` (generateDailySummary function)

**Interfaces:**
- Consumes: None
- Produces: Daily summary groups notifications by correct type names

- [ ] **Step 1: Read current summary function**

Read `src/lib/notifications/email-service.ts`, find `generateDailySummary`.

- [ ] **Step 2: Fix type groupings**

Change the group-by logic from:
```typescript
// Before (wrong types):
const likes = all.filter(n => n.type === 'like')
const comments = all.filter(n => n.type === 'comment')
const admin = all.filter(n => n.type === 'admin')
const system = all.filter(n => n.type === 'system')
```

To:
```typescript
// After (correct types):
const endorsements = all.filter(n =>
  n.type === 'mod_endorse' || n.type === 'mod_endorse_milestone'
)
const comments = all.filter(n =>
  n.type === 'comment_reply' || n.type === 'like'
)
const admin = all.filter(n =>
  n.type === 'admin_action' || n.type === 'admin_user_register' ||
  n.type === 'admin_request' || n.type === 'admin_report' ||
  n.type === 'admin_milestone'
)
const system = all.filter(n =>
  n.type === 'tier_upgrade' || n.type === 'special_role_assigned' ||
  n.type === 'special_role_removed' || n.type === 'mod_featured'
)
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/email-service.ts
git commit -m "fix: correct notification type names in daily summary"
```

---

## Phase 2: Architecture Redesign

### Task 7: Create NotificationType enum

**Files:**
- Create: `src/lib/notifications/types.ts`

**Interfaces:**
- Consumes: None
- Produces: `NotificationType` enum exported from `@/lib/notifications/types`

- [ ] **Step 1: Create types file**

Create `src/lib/notifications/types.ts`:
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

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.CommentReply]: 'رد على تعليق',
  [NotificationType.Like]: 'إعجاب',
  [NotificationType.ModEndorse]: 'تصويت على تعريب',
  [NotificationType.ModEndorseMilestone]: 'إنجاز تصويت',
  [NotificationType.ModFeatured]: 'تعريب مميز',
  [NotificationType.TierUpgrade]: 'ترقية مستوى',
  [NotificationType.SpecialRoleAssigned]: 'دور مخصص',
  [NotificationType.SpecialRoleRemoved]: 'إزالة دور',
  [NotificationType.AdminAction]: 'إجراء إداري',
  [NotificationType.AdminUserRegister]: 'تسجيل مستخدم',
  [NotificationType.AdminRequest]: 'طلب مستخدم',
  [NotificationType.AdminReport]: 'بلاغ',
  [NotificationType.AdminMilestone]: 'إنجاز إداري',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications/types.ts
git commit -m "feat: add centralized NotificationType enum"
```

---

### Task 8: Add actorId to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (Notification model)
- Create: `prisma/migrations/20260727_add_actor_id/migration.sql`

**Interfaces:**
- Consumes: None
- Produces: `Notification.actorId` field, `Notification.actor` relation

- [ ] **Step 1: Add field to schema**

In `prisma/schema.prisma`, add to the Notification model:
```prisma
model Notification {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  actorId   String?   @map("actor_id")        # ADD THIS
  type      String
  title     String
  message   String
  data      Json?
  isRead    Boolean   @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  user   User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  actor  User?             @relation(fields: [actorId], references: [id], onDelete: SetNull)  # ADD THIS
  logs   NotificationLog[]

  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
  @@index([type])
  @@map("notifications")
}
```

Also add to the User model:
```prisma
model User {
  ...
  notifications          Notification[]        @relation("UserNotifications")
  actingNotifications    Notification[]        @relation("ActorNotifications")  # ADD THIS
  ...
}
```

- [ ] **Step 2: Generate migration**

```bash
npx prisma migrate dev --name add_actor_id
```

- [ ] **Step 3: Backfill existing data**

Create and run backfill script:
```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const result = await prisma.\$executeRaw\`
    UPDATE notifications
    SET actor_id = data->'actor'->>'id'
    WHERE data->'actor'->>'id' IS NOT NULL
    AND actor_id IS NULL
  \`
  console.log('Backfilled', result, 'notifications')
}
main().catch(console.error).finally(() => prisma.\$disconnect())
"
```

- [ ] **Step 4: Verify**

```bash
npx prisma studio
```
Check that `actor_id` column exists and has values.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add actorId field to Notification model"
```

---

### Task 9: Refactor notification-helpers to use enum and actorId

**Files:**
- Modify: `src/lib/notification-helpers.ts`

**Interfaces:**
- Consumes: `NotificationType` from `@/lib/notifications/types`
- Produces: Updated `createNotification()`, `notifyCommentReply()`, `notifyModEndorseMilestone()`, `notifyModFeatured()`, `notifyAdminAction()` all using enum + actorId

- [ ] **Step 1: Read current helpers**

Read `src/lib/notification-helpers.ts` fully.

- [ ] **Step 2: Update imports and createNotification**

```typescript
import { NotificationType } from '@/lib/notifications/types'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  actorId?: string
  data?: Record<string, any>
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.link ? { link: params.link, ...params.data } : params.data,
        actorId: params.actorId,
      },
    })

    // Send realtime notification
    try {
      await sendRealtimeNotification(params.userId)
    } catch (e) {
      console.error('Failed to send realtime notification:', e)
    }

    return notification
  } catch (error) {
    console.error('Failed to create notification:', error)
    return null
  }
}
```

- [ ] **Step 3: Update notifyCommentReply**

```typescript
export async function notifyCommentReply(opts: {
  userId: string
  actorId: string
  modName: string
  link?: string
}) {
  if (opts.userId === opts.actorId) return null
  return createNotification({
    userId: opts.userId,
    type: NotificationType.CommentReply,
    title: 'رد على تعليقك',
    message: `قام شخص بالرد على تعليقك في تعريب ${opts.modName}`,
    link: opts.link,
    actorId: opts.actorId,
  })
}
```

- [ ] **Step 4: Update notifyModEndorseMilestone**

```typescript
export async function notifyModEndorseMilestone(opts: {
  userId: string
  modName: string
  count: number
  link?: string
}) {
  return createNotification({
    userId: opts.userId,
    type: NotificationType.ModEndorseMilestone,
    title: 'إنجاز تصويت',
    message: `حصل تعريب ${opts.modName} على ${opts.count} تصويت`,
    link: opts.link,
  })
}
```

- [ ] **Step 5: Update notifyModFeatured**

```typescript
export async function notifyModFeatured(opts: {
  userId: string
  modName: string
  link?: string
}) {
  return createNotification({
    userId: opts.userId,
    type: NotificationType.ModFeatured,
    title: 'تعريب مميز',
    message: `تم اختيار تعريب ${opts.modName} كتعريب مميز`,
    link: opts.link,
  })
}
```

- [ ] **Step 6: Update notifyAdminAction**

```typescript
export async function notifyAdminAction(opts: {
  userId: string
  title: string
  message: string
  link?: string
}) {
  return createNotification({
    userId: opts.userId,
    type: NotificationType.AdminAction,
    title: opts.title,
    message: opts.message,
    link: opts.link,
  })
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/notification-helpers.ts
git commit -m "refactor: notification helpers use NotificationType enum and actorId"
```

---

### Task 10: Update notification handlers to use enum

**Files:**
- Modify: `src/lib/notifications/handlers/translator-like-handler.ts`
- Modify: `src/lib/notifications/handlers/translator-comment-handler.ts`
- Modify: `src/lib/notifications/handlers/comment-reply-handler.ts`
- Modify: `src/lib/notifications/handlers/admin-handler.ts`

**Interfaces:**
- Consumes: `NotificationType` from `@/lib/notifications/types`
- Produces: All handlers using enum instead of raw strings

- [ ] **Step 1: Update translator-like-handler.ts**

Replace raw string `'like'` with `NotificationType.Like`:
```typescript
import { NotificationType } from '@/lib/notifications/types'

// In the create call:
type: NotificationType.Like,
```

- [ ] **Step 2: Update translator-comment-handler.ts**

Replace raw string `'comment'` with `NotificationType.CommentReply`:
```typescript
import { NotificationType } from '@/lib/notifications/types'

type: NotificationType.CommentReply,
```

- [ ] **Step 3: Update comment-reply-handler.ts**

Replace raw string `'comment'` with `NotificationType.CommentReply`:
```typescript
import { NotificationType } from '@/lib/notifications/types'

type: NotificationType.CommentReply,
```

- [ ] **Step 4: Update admin-handler.ts**

Replace raw strings with enum values:
```typescript
import { NotificationType } from '@/lib/notifications/types'

// Map event types to notification types:
const typeMap: Record<string, NotificationType> = {
  user_register: NotificationType.AdminUserRegister,
  request: NotificationType.AdminRequest,
  report: NotificationType.AdminReport,
  milestone: NotificationType.AdminMilestone,
}
```

- [ ] **Step 5: Update reports/auto-actions.ts and reports/repeat-offender.ts**

Find direct `db.notification.create` calls and replace `type: 'admin_action'` with `type: NotificationType.AdminAction`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/handlers/ src/lib/reports/
git commit -m "refactor: notification handlers use NotificationType enum"
```

---

### Task 11: Wire Supabase Realtime on client

**Files:**
- Modify: `src/components/notification-bell.tsx`
- Modify: `src/components/notification-dropdown.tsx`

**Interfaces:**
- Consumes: `subscribeToNotifications()` from `@/lib/notifications/realtime`
- Produces: Real-time notification delivery, no polling

- [ ] **Step 1: Read current notification-bell.tsx**

Read `src/components/notification-bell.tsx` fully.

- [ ] **Step 2: Replace polling with Realtime subscription**

```typescript
import { subscribeToNotifications } from '@/lib/notifications/realtime'

// In the component, replace setInterval with:
useEffect(() => {
  if (!user?.id) return

  const unsubscribe = subscribeToNotifications(user.id, (notification) => {
    setNotifications(prev => [notification, ...prev])
    setUnreadCount(prev => prev + 1)
  })

  return () => {
    unsubscribe?.()
  }
}, [user?.id])
```

- [ ] **Step 3: Remove polling code**

Delete the `setInterval` and `fetchUnreadCount` interval logic.

- [ ] **Step 4: Update notification-dropdown.tsx**

Apply same Realtime subscription pattern to dropdown for live updates.

- [ ] **Step 5: Test manually**

Run `bun run dev`, open two browser tabs. In one tab, create a notification (e.g., reply to a comment). Verify the other tab receives it instantly without refresh.

- [ ] **Step 6: Commit**

```bash
git add src/components/notification-bell.tsx src/components/notification-dropdown.tsx
git commit -m "feat: wire Supabase Realtime for instant notification delivery"
```

---

### Task 12: Update API whitelist to use enum

**Files:**
- Modify: `src/app/api/notifications/route.ts` (POST handler)

**Interfaces:**
- Consumes: `NotificationType` from `@/lib/notifications/types`
- Produces: API whitelist using enum values

- [ ] **Step 1: Read current POST handler**

Read `src/app/api/notifications/route.ts` POST handler.

- [ ] **Step 2: Replace string whitelist with enum**

```typescript
import { NotificationType } from '@/lib/notifications/types'

const ALLOWED_NOTIFICATION_TYPES = new Set([
  NotificationType.CommentReply,
  NotificationType.ModEndorse,
  NotificationType.ModEndorseMilestone,
  NotificationType.ModFeatured,
  NotificationType.TierUpgrade,
  NotificationType.SpecialRoleAssigned,
  NotificationType.SpecialRoleRemoved,
  NotificationType.AdminAction,
])
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/route.ts
git commit -m "refactor: API notification whitelist uses NotificationType enum"
```

---

### Task 13: Update notification views to use enum labels

**Files:**
- Modify: `src/views/notifications.tsx`

**Interfaces:**
- Consumes: `NOTIFICATION_TYPE_LABELS` from `@/lib/notifications/types`
- Produces: Views using centralized labels

- [ ] **Step 1: Read current views**

Read `src/views/notifications.tsx`.

- [ ] **Step 2: Replace hardcoded type labels**

```typescript
import { NotificationType, NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'

// Replace hardcoded typeLabels object:
const typeIcons: Record<string, any> = {
  [NotificationType.CommentReply]: MessageCircle,
  [NotificationType.Like]: Heart,
  [NotificationType.ModEndorse]: Heart,
  [NotificationType.ModEndorseMilestone]: Star,
  [NotificationType.ModFeatured]: Star,
  [NotificationType.AdminAction]: Shield,
  [NotificationType.AdminUserRegister]: Users,
  [NotificationType.AdminRequest]: FileText,
  [NotificationType.AdminReport]: AlertTriangle,
  [NotificationType.TierUpgrade]: Award,
  [NotificationType.SpecialRoleAssigned]: Shield,
  [NotificationType.SpecialRoleRemoved]: Shield,
}

// Use NOTIFICATION_TYPE_LABELS for display text
```

- [ ] **Step 3: Commit**

```bash
git add src/views/notifications.tsx
git commit -m "refactor: notification views use centralized type labels"
```

---

### Task 14: Update tests

**Files:**
- Modify: `src/__tests__/notifications/handlers.test.ts`

**Interfaces:**
- Consumes: `NotificationType` from `@/lib/notifications/types`
- Produces: Tests using enum values

- [ ] **Step 1: Read current tests**

Read `src/__tests__/notifications/handlers.test.ts`.

- [ ] **Step 2: Update test assertions**

Replace raw string type checks with enum:
```typescript
import { NotificationType } from '@/lib/notifications/types'

// In test assertions:
expect(db.notification.create).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      type: NotificationType.Like,
    }),
  })
)
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/__tests__/notifications/ -v
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/notifications/handlers.test.ts
git commit -m "test: update notification tests to use NotificationType enum"
```

---

### Task 15: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
npx jest -v
```
Expected: All tests pass.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Run lint**

```bash
bun run lint
```
Expected: No new errors.

- [ ] **Step 4: Manual smoke test**

Run `bun run dev`, test:
1. Notification bell shows unread count
2. Clicking bell shows dropdown with avatars and links
3. Clicking notification navigates to correct page
4. "Mark all as read" works
5. Bulk delete works
6. Notifications appear in real-time (test with two tabs)
7. Settings page shows notification preferences
8. Admin can edit notification type/title

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: notification system redesign complete"
```
