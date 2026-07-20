# Task 9: Build Notification Bell Component

## What I Implemented

Created `src/components/notifications/NotificationBell.tsx` - a React component that displays a bell icon with an unread notification count badge and opens a dropdown when clicked.

### Features:
- **Bell Icon with Badge**: Displays a bell icon with a red badge showing the unread notification count (capped at 99+)
- **Realtime Subscription**: Uses `subscribeToNotifications` from `@/lib/notifications/realtime` to receive live notifications via Supabase Realtime
- **Mark as Read**: Can mark individual notifications as read via PATCH to `/api/notifications/${id}/read`
- **Mark All as Read**: Can mark all notifications as read via POST to `/api/notifications/read-all`
- **Dropdown Toggle**: Opens/closes a `NotificationDropdown` component when the bell is clicked

## Files Changed

- **Created**: `src/components/notifications/NotificationBell.tsx` (80 lines)

## API Endpoints Used

- `GET /api/notifications/count` - Fetch initial unread count
- `PATCH /api/notifications/${id}/read` - Mark single notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read

## Issues or Concerns

1. **Props Interface Mismatch**: The provided code uses `userId: string` as the prop, but the existing `NotificationBell` in `src/components/notification-bell.tsx` uses `currentUser: { id: string; username: string } | null`. The new component is not yet integrated into the navbar.

2. **Import Path for NotificationDropdown**: The new component imports from `./NotificationDropdown` (relative path), but there's no `NotificationDropdown.tsx` in the `notifications/` directory. It should import from `@/components/notification-dropdown` or a new file needs to be created in the notifications directory.

3. **Missing Dependencies**: The component imports `BellIcon` from `@heroicons/react/24/outline`, but the existing codebase uses `Bell` from `lucide-react`. This may require installing the `@heroicons/react` package.

4. **API Method Mismatch**: The existing API routes use `PUT` for marking notifications as read, but the provided code uses `PATCH`. This needs to be verified.

## Recommendations

1. Update the navbar to import from the new location or refactor the existing component
2. Ensure `NotificationDropdown` is properly accessible from the new path
3. Verify heroicons package is installed or switch to lucide-react for consistency
4. Verify API method types match the backend implementation
