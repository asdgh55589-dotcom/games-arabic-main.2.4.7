# Task 8 Report: Setup Supabase Realtime

**Status:** DONE

## What Was Implemented

Replaced the Redis-based realtime notification system with Supabase Realtime in `src/lib/notifications/realtime.ts`.

### `subscribeToNotifications(userId, callback)`
- Subscribes to PostgreSQL `INSERT` changes on the `notifications` table filtered by `user_id`
- Returns a `RealtimeChannel` for lifecycle management (unsubscribe, etc.)
- Fires `callback(payload.new)` whenever a new notification row is inserted

### `sendRealtimeNotification(userId)`
- Broadcasts a `new_notification` event to the user's channel
- Used to trigger client-side refresh/UX updates

## Files Changed

- `src/lib/notifications/realtime.ts` — Replaced Redis `@upstash/redis` implementation with Supabase Realtime using `@supabase/supabase-js`

## Dependencies

- `@supabase/supabase-js` v2.110.7 (already installed)

## Issues / Concerns

- Uses `SUPABASE_SERVICE_ROLE_KEY` for the server-side client. For client-side subscriptions, a separate browser client (with anon key) should be created instead.
- Pre-existing TypeScript errors in other files are unrelated to this change.
