# Backup Strategy

> Neon is the live primary database. Create `pg_trgm` and `pgcrypto` **before**
> restoring a dump (`20261023000000_add_neon_extensions`); production has no
> GIN indexes and 98 public base tables.

> Last updated: 2026-10-23

## §1 Overview

Defense-in-depth backup architecture with two independent recovery layers:

| Layer | Method | RPO | RTO | Scope |
|-------|--------|-----|-----|-------|
| **Primary** | Neon restore history / point-in-time branch | 5 min | < 30 min | Full database, point-in-time |
| **Secondary** | Weekly pg_dump | ~7 days | ~1 hour | Full schema + data snapshot |

Neon point-in-time recovery (PITR) provides continuous protection inside the project. pg_dump provides
offline, portable snapshots for disaster recovery when Neon itself is
unreachable.

## §2 Neon restore history (PITR)

**Configure in:** Neon Console → Project → Settings → **History retention**

- **Retention:** plan-dependent; keep at least 7 days (increase for compliance)
- **RPO:** 5 minutes (continuous history)
- **RTO:** < 30 minutes (restore branch + validation)

### Restore Procedure

1. Open Neon Console → project → **Branches** → **Restore**
2. Choose **Restore to a point in time** and select a timestamp inside the
   retention window
3. Name the restore branch `incident-YYYYMMDD-HHmm`
4. Wait for the branch to become ready
5. Validate row counts and spot-check `User`, `Mod`, and `ModFile`
6. Promote the restored branch to primary
7. Update `DATABASE_URL` / `DIRECT_URL` if the endpoint name changed
8. Run `npx prisma migrate status` to verify schema consistency
9. Smoke test critical flows

**Reference:** See [NEON-SETUP.md](./NEON-SETUP.md) §8 for the full incident
checklist and rollback procedure.

## §3 Weekly pg_dump

### Script

- **Location:** `scripts/weekly-backup.sh`
- **Schedule:** Every Sunday at 01:00 UTC (via external cron or CI)
- **Format:** `pg_dump --format=custom --no-owner --no-privileges --schema=public`
- **Output:** `backups/weekly/db-YYYYMMDD-HHmmss.dump`

### Features

- `--dry-run` flag prints commands without executing
- Reads `DIRECT_URL` only and rejects pooled (`-pooler`) endpoints; never falls back to `DATABASE_URL`
- SHA256 checksum + manifest JSON for integrity verification
- Colored terminal output (green=pass, red=fail)

### S3 Upload

When `BACKUP_S3_ENDPOINT` and `BACKUP_S3_BUCKET` are set, the script uploads the dump and manifest with `aws s3 cp` (SigV4). Credentials come from `BACKUP_S3_ACCESS_KEY`/`BACKUP_S3_SECRET_KEY` or the AWS credential chain. S3-compatible storage (MinIO, R2, etc.) is supported.

### Retention

- **Local:** Keep last 4 weekly dumps (older deleted automatically)
- **S3:** No automatic lifecycle — configure bucket lifecycle policy separately

## §4 Retention Matrix

| Backup Type | Retention | Storage | Access |
|-------------|-----------|---------|--------|
| Neon restore history | 7 days minimum (plan-dependent) | Neon managed | Neon Console / API |
| Weekly pg_dump | 4 dumps (~28 days) | Local `backups/weekly/` + optional S3 | Script / SSH / S3 console |
| Monthly archive | Manual | Long-term S3 / offline | Manual download + verify |

### Monthly Archive (Manual)

On the first Sunday of each month, after the weekly backup:

1. Copy the weekly dump to a long-term archive location
2. Name format: `archive/monthly-YYYYMM.dump`
3. Retain for 12 months minimum
4. Verify SHA256 against manifest

## §5 Restore Drill

Perform monthly to verify backup integrity and restore capability.

### Procedure

1. **Select backup:** Choose a recent weekly dump (not the latest — test an older one)
2. **Verify integrity:** `sha256sum -c <manifest>` to confirm checksum
3. **Restore to staging:**
   ```bash
   pg_restore --no-owner --no-privileges --schema=public -d <staging_db> <dump_file>
   ```
4. **Apply migrations:** `npx prisma migrate deploy`
5. **Verify:**
   - `npx prisma migrate status` → "Database schema is up to date!"
   - `public` has 98 base tables and 0 GIN indexes
   - `pg_trgm` + `pgcrypto` extensions are present
   - Spot-check critical tables (users, mods, games)
   - Run application smoke tests against staging
6. **Document:** Record results in incident log with timestamp, backup file, duration, and any issues

### Success Criteria

- pg_restore exits 0
- Schema matches production (prisma migrate status clean)
- No data corruption in spot-checked tables

## §6 Monitoring

### Backup Failure Alerts

The weekly backup script exits non-zero on any failure. External monitoring should:

1. **Alert on exit code ≠ 0** from the cron job
2. **Alert on missing manifest** (backup ran but didn't produce a manifest)
3. **Alert on size anomaly** (dump < 1MB likely means empty/failed dump)

### Restore History Health

Verify the restore window weekly in the Neon Console:

- **Project → Settings → History retention** shows the expected window.
- Create and delete a throwaway restore branch from yesterday; if the branch
  cannot be created, history retention is shorter than expected.

A missing restore point or a retention window under 7 days is an incident:
extend retention or take an immediate off-site `pg_dump`.

### Backup Age Alert

Alert if no successful backup exists within 8 days (restore history) or 10 days
(pg_dump). This catches silent failures in both layers.
