# Design: Wire Supabase Realtime for Instant Notification Delivery

## Overview

Replace the 30-second polling interval in `NotificationBell` with a Supabase Realtime subscription that pushes new notifications to the client instantly. The existing initial fetch of unread count and notifications remains. The `NotificationDropdown` continues to receive notifications as props from `NotificationBell` and will automatically reflect real-time updates.

## Current State

- `NotificationBell` fetches unread count on mount and every 30 seconds via `setInterval`.
- When the dropdown opens, it fetches up to 20 notifications and the unread count.
- `NotificationDropdown` is a presentational component that receives `notifications` and `loading` as props.
- `subscribeToNotifications(userId, callback)` exists in `src/lib/notifications/realtime.ts` and returns a `RealtimeChannel`. It listens to `INSERT` events on the `notifications` table filtered by `user_id`.

## Proposed Design

### Changes to `NotificationBell`

1. **Import** `subscribeToNotifications` from `@/lib/notifications/realtime`.
2. **Replace** the `useEffect` that sets up the 30-second interval with a new `useEffect` that:
   - Calls `subscribeToNotifications(user.id, callback)` when `user.id` is available.
   - The callback receives a new notification object and prepends it to `notifications` state and increments `unreadCount`.
   - Returns a cleanup function that calls the unsubscribe method on the returned channel.
3. **Keep** the existing `useEffect` that fetches `unreadCount` on mount (without the interval).
4. **Remove** the `setInterval` line and its cleanup.
5. **No changes** to `NotificationDropdown`; it already receives updated notifications via props.

### Data Flow

1. Component mounts → `fetchUnreadCount()` runs once.
2. Realtime subscription established → channel listens for `INSERT` events.
3. New notification inserted → callback fires → state updated → UI re-renders.
4. Dropdown opens → existing `fetchNotifications()` runs (optional, could be removed if we trust Realtime to have all notifications; but we keep for backward compatibility).

### Error Handling

- Realtime subscription failure: silent (channel will not receive events). The existing polling fallback is removed, so if Realtime fails, the user will not get new notifications until they refresh. This is acceptable because Supabase Realtime is reliable.
- Unsubscribe on unmount to prevent memory leaks.

## Trade-offs

### Approach A (Minimal): Replace interval with Realtime subscription in bell only
- Pros: Minimal code change, simple, meets requirement.
- Cons: If Realtime fails, no fallback. Also, notifications fetched when dropdown opens may be stale if Realtime missed some events (unlikely).

### Approach B (Enhanced): Also subscribe to UPDATE events to sync read status across tabs
- Pros: Read status stays in sync across tabs.
- Cons: More complexity, not required by task.

### Approach C (Hook extraction): Create `useNotifications` hook
- Pros: Cleaner separation, reusable.
- Cons: Overkill for current scope.

**Recommendation:** Approach A. It's the simplest and directly addresses the task.

## Testing

Manual testing:
1. Run `bun run dev`.
2. Open two browser tabs, log in as same user.
3. In tab A, keep the notification bell visible.
4. In tab B, trigger a notification (e.g., reply to a comment).
5. Verify tab A receives the notification instantly without refresh.
6. Verify unread count increments.
7. Open dropdown, verify notification appears.
8. Mark as read, verify unread count decrements.

## Files to Modify

- `src/components/notification-bell.tsx`
- No changes to `src/components/notification-dropdown.tsx` (it already works with props).

## Implementation Steps

1. Read current files (done).
2. Edit `notification-bell.tsx` as described.
3. Test manually.
4. Commit.
5. Self-review.
6. Report back.