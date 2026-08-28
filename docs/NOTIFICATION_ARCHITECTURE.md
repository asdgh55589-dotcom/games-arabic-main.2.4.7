# Notification System Architecture

## Overview

The notification system delivers in-app, email, and (future) Telegram notifications to users based on platform events. It follows Clean Architecture with clear separation between Domain, Application, and Infrastructure layers.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│              Application Layer                   │
│  Use Cases (20) → NotificationService            │
│  Event Handlers → Metrics → Logger               │
├─────────────────────────────────────────────────┤
│               Domain Layer                       │
│  Entities: Notification, NotificationJob,        │
│            NotificationPreference                 │
│  Value Objects: NotificationType, NotificationChannel │
│  Policies: Deduplication, Preference, Delivery   │
│  Events: Created, Delivered, Failed              │
│  Ports: Repositories, Renderers, Senders         │
├─────────────────────────────────────────────────┤
│            Infrastructure Layer                  │
│  Repositories: Prisma implementations            │
│  Adapters: Handlebars renderer, Resend email     │
│  Resilience: Circuit Breaker, Retry, Dead Letter │
│  Observability: Logger, Metrics, Alerts          │
│  DI Container: Singleton factories               │
└─────────────────────────────────────────────────┘
```

## Domain Layer

### Entities
- **Notification** — Immutable domain entity with validation. Created via `Notification.create()`.
- **NotificationJob** — Tracks delivery jobs across channels with retry state.
- **NotificationPreference** — User preferences including quiet hours and per-type overrides.

### Value Objects
- **NotificationType** — 20 types organized by category (Social, Mods, Tiers, Admin, System).
- **NotificationChannel** — `InApp`, `Email`, `Telegram`.
- **DeliveryStatus** — `Pending`, `Processing`, `Sent`, `Failed`, `DeadLetter`.

### Policies
- **DeduplicationPolicy** — Prevents duplicate notifications within configurable time windows.
- **PreferencePolicy** — Checks user preferences before delivery.
- **ExponentialBackoffDeliveryPolicy** — Determines retry behavior.

### Events
- `notification.created` — When a notification is saved to DB.
- `notification.delivered` — When delivery succeeds.
- `notification.failed` — When delivery fails.

## Application Layer

### NotificationService
The **single entry point** for all notification sending. Orchestrates:
1. Preference check → 2. Template rendering → 3. Deduplication check → 4. Entity creation → 5. Persist → 6. Event publish → 7. Job queue (for non-InApp channels)

### Use Cases (20 total)
Each use case is a single-responsibility class with an `execute(context)` method.

**Social (5):** CommentReply, TopLevelComment, Like, Follow, EndorseMilestone
**Mods (4):** ModPublished, ModUpdated, ModDeleted, ModFeatured
**Tiers & Roles (4):** TierUpgrade, TierRevoked, SpecialRoleAssigned, SpecialRoleRemoved
**Reports (5):** ReportSubmitted, ReportConfirmed, ReportRejected, AutoWarning, AutoBan
**Admin (2):** AdminAlert, SystemAnnouncement

### DI Container
`src/infrastructure/di/notification-container.ts` provides singleton `NotificationService` and `NotificationQueryService`.

## Infrastructure Layer

### Repositories
- `PrismaNotificationRepository` — CRUD for notifications.
- `PrismaPreferenceRepository` — User preference management.
- `PrismaJobQueue` — Atomic job processing with `updateMany` to prevent double-processing.
- `PrismaTemplateRepository` — Template storage and retrieval.

### Adapters
- **HandlebarsTemplateRenderer** — Renders notification templates using Handlebars.
- **ResendEmailSender** — Sends emails via Resend API with circuit breaker and retry.

### Resilience
- **CircuitBreaker** — Opens after N consecutive failures, transitions to HALF_OPEN after timeout.
- **RetryPolicy** — Exponential backoff with jitter.
- **DeadLetterHandler** — Tracks jobs that exhausted all retry attempts.

### Observability
- **NotificationLogger** — Structured JSON logger replacing console.log.
- **MetricsService** — In-memory metrics (created, delivered, failed, deduplicated, etc.).
- **AlertService** — Health monitoring with configurable conditions.

## Template System

Templates use Handlebars syntax with Arabic content. Each template has:
- `type` + `channel` composite key
- `titleTemplate` and `bodyTemplate` with `{{variable}}` placeholders
- `variables` array for validation
- `version` for template updates
- Admin UI for CRUD, preview, and version management

## Preferences

Users can configure:
- **Channel switches:** `emailEnabled`, `pushEnabled`
- **Quiet hours:** Time range when push notifications are suppressed
- **Per-type overrides:** Disable specific notification types or channels
- **Summary settings:** Daily digest with configurable interval

## Deduplication

Within configurable time windows:
- `comment_reply`: 5 minutes
- `like`: 10 minutes
- `admin_action`: 60 minutes
- `admin_report`: 30 minutes
- All others: No deduplication (window = 0)

Critical notifications (bans, role changes) use `skipDeduplication: true`.

## Polling Strategy

Client-side polling replaces Supabase Realtime:
- Uses `setInterval` with Page Visibility API (pauses when tab hidden)
- Adaptive intervals: 5s (foreground) / 30s (background)
- Fetches unread count and recent notifications

## Monitoring

### Admin Dashboard
- Health API: `GET /api/admin/notifications-health`
- Dashboard page: `/admin/notifications-health`
- Shows: delivery rate, failure rate, metrics, recent failures

### Metrics Tracked
- `notifications.created.total`
- `notifications.delivered.total`
- `notifications.failed.total`
- `notifications.retried.total`
- `notifications.deduplicated.total`
- `notifications.preference_skipped.total`

## Database Schema

### notification
- `id`, `userId`, `actorId`, `type`, `title`, `message`, `data` (JSONB), `isRead`, `readAt`, `createdAt`, `updatedAt`

### notification_job
- `id`, `notificationId`, `channel`, `status`, `attempts`, `maxAttempts`, `lastError`, `scheduledFor`, `processedAt`, `createdAt`, `updatedAt`

### notification_preference
- `id`, `userId`, `emailEnabled`, `pushEnabled`, `dailySummary`, `summaryIntervalDays`, `likeThreshold`, `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`, `typePreferences` (JSONB), `createdAt`, `updatedAt`

### notification_template
- `id`, `type`, `channel`, `titleTemplate`, `bodyTemplate`, `variables` (JSON), `isActive`, `version`, `createdAt`, `updatedAt`
- Unique constraint on `type` + `channel`
