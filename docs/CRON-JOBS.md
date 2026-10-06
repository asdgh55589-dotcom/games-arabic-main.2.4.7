# Cron Jobs

> Last updated: 2026-10-05

All cron endpoints are protected with Bearer token authentication via `$CRON_SECRET`.

## Job Table

| Job | Endpoint | Schedule (UTC) | Auth | Timeout | Retry | Failure Action |
|-----|----------|---------------|------|---------|-------|----------------|
| image-health | `/api/cron/image-health` | `0 2 * * 0` (Sun 02:00) | `Bearer $CRON_SECRET` | 5 min | 1 retry, 5 min delay | Alert + skip broken images |
| promote-tiers | `/api/cron/promote-tiers` | `0 3 1 * *` (1st of month, 03:00) | `Bearer $CRON_SECRET` | 10 min | 1 retry, 5 min delay | Alert admin + manual review |
| backup-cleanup | `/api/cron/backup-cleanup` | `0 4 * * *` (Daily 04:00) | `Bearer $CRON_SECRET` | 5 min | 1 retry, 5 min delay | Alert + keep existing backups |
| weekly-backup | `/api/cron/weekly-backup` | `0 1 * * 0` (Sun 01:00) | `Bearer $CRON_SECRET` | 15 min | 1 retry, 5 min delay | Alert + trigger manual backup |
| notification-drain | `/api/cron/notification-drain` | `* * * * *` (Every minute) | `Bearer $CRON_SECRET` | ~8 s per run (bounded batches) | Exponential backoff per job, `maxAttempts = 5` | `dead_letter` → visible in `/admin/notifications-health` |
| template-publish | `/api/cron/template-publish` | `* * * * *` (Every minute — idle runs are a single indexed query) | `Bearer $CRON_SECRET` | ~8 s per run (bounded batch of 20) | Requeue until `maxRetries = 3`, then `failed` with `error` set | `ScheduledJob.status=failed` + error log; template stays a draft |

> **Scheduling note (P2):** there is no `vercel.json` in this repository, so the
> `notification-drain` schedule above is a **suggested** cron entry, not an
> installed one. Add it to whichever scheduler fronts the deployment (Vercel
> `crons`, cron-job.org, …). Cadence matters more than precision: each run takes
> a bounded batch and returns a `nextCursor`, so an unfinished backlog resumes
> on the next tick instead of being re-scanned.

## Invocation

```bash
curl -X GET https://yourdomain.com/api/cron/image-health \
  -H "Authorization: Bearer $CRON_SECRET"
```

POST requests are also accepted. The `$CRON_SECRET` environment variable must be set in production.

## Expected Responses

All endpoints return JSON with `ok: true` on success and `ok: false` with an `error` field on failure.

### image-health

```json
{ "ok": true, "checked": 120, "broken": 3, "fixed": 2, "skipped": 1, "duration_ms": 4200 }
```

Scans mod images for broken URLs, attempts re-upload via Cloudinary, logs results to `ImageHealthLog`.

### promote-tiers

```json
{ "ok": true, "promoted": 5, "demoted": 1, "evaluated": 42, "duration_ms": 8100 }
```

Evaluates all active users against `TierRule` thresholds, updates tiers, and records history in `TierHistory`.

### backup-cleanup

```json
{ "ok": true, "deleted": 3, "remaining": 7, "duration_ms": 120 }
```

Removes old backups exceeding retention limits (7 daily, 4 weekly, 12 monthly) from `backups/` directory.

### weekly-backup

```json
{ "ok": true, "filename": "db-20260913-010000.dump", "size_bytes": 52428800, "sha256": "abc123...", "duration_ms": 15200 }
```

Runs `pg_dump --format=custom` against the database, optionally uploads to S3, and enforces 4-dump retention.

### notification-drain

```json
{
  "data": {
    "scanned": 18, "processed": 18, "sent": 12, "retried": 2,
    "deferred": 3, "skipped": 1, "deadLettered": 0,
    "hasMore": true, "nextCursor": "1770000000000:cmh000abc",
    "batches": 2, "durationMs": 4910,
    "resume": "/api/cron/notification-drain?cursor=1770000000000%3Acmh000abc"
  }
}
```

Consumes `NotificationJob` rows (`email` + `telegram`, both the legacy
`lib/notifications` writer and the clean-arch `PrismaJobQueue`):

- **deferred** — quiet hours are active in the recipient's timezone; the job is
  rescheduled to the end of that window (nothing is dropped).
- **skipped** — no deliverable target (disabled preference, synthetic Telegram
  address, no linked chat).
- **retried** — provider/network failure; `scheduledFor` moves out by
  60 s → 2 min → 4 min → 8 min, then `dead_letter`.
- Every attempt is written to `NotificationLog`; its `id` is the `requestId` of
  the email and the tracking-pixel/`click` id (`/api/notifications/track`).

### template-publish

```json
{ "ok": true, "due": 2, "published": 2, "skipped": 0, "failed": 0 }
```

Executes due `ScheduledJob` rows of type `template_publish` (created by
`POST /api/admin/templates/[id]/publish` with `scheduledFor`). Each due job is
claimed idempotently (`pending → running`), the template is re-validated through
the canonical rich-text rules, and only then flipped to `isActive: true` with an
immutable version snapshot — an invalid template fails the job instead of going
live. A deleted template is recorded as `completed` with a note (`skipped`),
retries requeue until `maxRetries = 3`.

## Monitoring

- Alert on any endpoint returning `ok: false`
- Alert if cron job does not fire within expected window (e.g., image-health missing by Sunday 03:00 UTC)
- Monitor `duration_ms` for regression (backup > 5 min may indicate DB growth)