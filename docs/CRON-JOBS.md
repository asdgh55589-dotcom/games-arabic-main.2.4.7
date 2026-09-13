# Cron Jobs

> Last updated: 2026-09-13

All cron endpoints are protected with Bearer token authentication via `$CRON_SECRET`.

## Job Table

| Job | Endpoint | Schedule (UTC) | Auth | Timeout | Retry | Failure Action |
|-----|----------|---------------|------|---------|-------|----------------|
| image-health | `/api/cron/image-health` | `0 2 * * 0` (Sun 02:00) | `Bearer $CRON_SECRET` | 5 min | 1 retry, 5 min delay | Alert + skip broken images |
| promote-tiers | `/api/cron/promote-tiers` | `0 3 1 * *` (1st of month, 03:00) | `Bearer $CRON_SECRET` | 10 min | 1 retry, 5 min delay | Alert admin + manual review |
| backup-cleanup | `/api/cron/backup-cleanup` | `0 4 * * *` (Daily 04:00) | `Bearer $CRON_SECRET` | 5 min | 1 retry, 5 min delay | Alert + keep existing backups |
| weekly-backup | `/api/cron/weekly-backup` | `0 1 * * 0` (Sun 01:00) | `Bearer $CRON_SECRET` | 15 min | 1 retry, 5 min delay | Alert + trigger manual backup |

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

## Monitoring

- Alert on any endpoint returning `ok: false`
- Alert if cron job does not fire within expected window (e.g., image-health missing by Sunday 03:00 UTC)
- Monitor `duration_ms` for regression (backup > 5 min may indicate DB growth)
