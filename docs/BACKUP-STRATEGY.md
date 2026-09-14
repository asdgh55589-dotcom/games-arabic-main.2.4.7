# Backup Strategy

> Last updated: 2026-09-13

## §1 Overview

Defense-in-depth backup architecture with two independent recovery layers:

| Layer | Method | RPO | RTO | Scope |
|-------|--------|-----|-----|-------|
| **Primary** | Aiven PITR (WAL archiving) | 5 min | < 30 min | Full database, point-in-time |
| **Secondary** | Weekly pg_dump | ~7 days | ~1 hour | Full schema + data snapshot |

PITR provides continuous protection. pg_dump provides offline, portable snapshots for disaster recovery when Aiven itself is unreachable.

## §2 Aiven PITR

**Enable in:** Aiven UI → Databases → Backup & Restore → Enable PITR

- **Retention:** 7 days (minimum; increase for compliance)
- **RPO:** 5 minutes (WAL segments archived continuously)
- **RTO:** < 30 minutes (restore + WAL replay)

### Restore Procedure

1. Open Aiven Console → your service → Backups & Restore
2. Click **Restore to new service** or **Point-in-time restore**
3. Select target timestamp (must be within PITR retention window)
4. Wait for restore to complete (typically 5–15 min)
5. Update `DATABASE_URL` to point to restored service
6. Run `npx prisma migrate status` to verify schema consistency
7. Smoke test critical flows

**Reference:** See [AIVEN-CONFIG.md](./AIVEN-CONFIG.md) for full PITR configuration, WAL settings, and connection pool tuning.

## §3 Weekly pg_dump

### Script

- **Location:** `scripts/weekly-backup.sh`
- **Schedule:** Every Sunday at 01:00 UTC (via external cron or CI)
- **Format:** `pg_dump --format=custom --no-owner --no-privileges --schema=public`
- **Output:** `backups/weekly/db-YYYYMMDD-HHmmss.dump`

### Features

- `--dry-run` flag prints commands without executing
- Reads `AIVEN_DATABASE_URL` (preferred) or `DATABASE_URL` from env
- SHA256 checksum + manifest JSON for integrity verification
- Colored terminal output (green=pass, red=fail)

### S3 Upload

When `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, and `BACKUP_S3_KEY` are set, the script uploads the dump via `curl -T` (PUT). S3-compatible storage (MinIO, R2, etc.) is supported.

### Retention

- **Local:** Keep last 4 weekly dumps (older deleted automatically)
- **S3:** No automatic lifecycle — configure bucket lifecycle policy separately

## §4 Retention Matrix

| Backup Type | Retention | Storage | Access |
|-------------|-----------|---------|--------|
| Aiven PITR | 7 days | Aiven managed | Aiven UI / API |
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

### PITR Health Check

Verify PITR status weekly via Aiven API or console:

```bash
# Aiven CLI
avn service backup-list <service-name>
```

Ensure backups appear daily. A gap > 24h indicates WAL archiving failure.

### Backup Age Alert

Alert if no successful backup exists within 8 days (PITR) or 10 days (pg_dump). This catches silent failures in both layers.
