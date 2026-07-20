# Task 12: Resend Email Service

## What was implemented

Created `src/lib/notifications/email-service.ts` — an email notification service using Resend for sending daily summary emails.

### Key features:
- **`generateDailySummary(userId: string)`** — Fetches unread notifications for a user, groups them by type (likes, comments, admin, system), and sends an RTL Arabic HTML email via Resend
- **`generateSummaryTemplate()`** — Private helper that produces the HTML email template with styled sections for each notification type
- Logs sent emails to the `NotificationLog` table with channel `'email'`
- Exports the function from `src/lib/notifications/index.ts`

## Files changed

| File | Change |
|------|--------|
| `src/lib/notifications/email-service.ts` | New — Resend email service |
| `src/lib/notifications/index.ts` | Modified — added export for `generateDailySummary` |

## Adaptations from provided code

The task spec used `import { prisma } from '@/lib/prisma'`, but this project uses `import { db } from '@/lib/db'` (the Prisma client is exported as `db` from `@/lib/db`). The code was adapted to match the existing codebase convention.

Also added the `system` section to the HTML template which was present in the `GroupedNotifications` interface but missing from the original template.

## Concerns

- The `RESEND_API_KEY` environment variable is not set in `.env` — it needs to be configured before the service can send emails
- The `NEXT_PUBLIC_APP_URL` variable is referenced in the template but not present in `.env` — needs to be set for the "view all notifications" link
- The sender address `notifications@yourdomain.com` is a placeholder — should be updated to match the actual verified Resend domain

## Verification

- TypeScript compilation: no errors from the new file (pre-existing errors in other files are unrelated)
- `resend@6.17.2` package confirmed installed
