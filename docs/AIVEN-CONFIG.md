# Aiven PostgreSQL Configuration — Phase 5 Cutover

> **Historical / source-side reference.** The current direction is Aiven →
> Neon. The live Aiven audit found **0 GIN indexes** and the pool timeout is
> now **15s** in `src/lib/db.ts`; the legacy 10s values below are retained for
> history. Use `docs/NEON-SETUP.md` for the cutover.

> **Current runtime:** `src/lib/db.ts` reads only `DATABASE_URL`; `AIVEN_DATABASE_URL` is ignored. Do not use this document to configure the live app.
>
> **Owner-locked:** Aiven PostgreSQL 16 · `eu-west-1` · pool size **5** (matches Neon) · `sslmode=require` mandatory.
> Aiven is the historical/rollback target. The live app uses Neon; see `docs/NEON-SETUP.md`.

## Pool & Prisma tuning

| Param | Value | Source | Notes |
|-------|-------|--------|-------|
| **Aiven pool size** | `5` | Aiven console → Service → Pools | Mirrors Neon pool size; do not increase without owner sign-off |
| **Prisma `connection_limit`** | `5` | `DATABASE_URL` query param | Keep ≤ pool size to avoid queuing; 5 matches Aiven pool |
| **`pool_timeout`** | `15` | `DATABASE_URL` query param | Seconds to wait for a connection from the pool; current code uses `15s` |
| **`connect_timeout`** | `15` | `DATABASE_URL` query param | Seconds for initial TCP/TLS connect; **injected as `15` if missing** by `src/lib/db.ts` — does not override an explicit value |
| **`sslmode`** | `require` | `DATABASE_URL` query param | **Mandatory** for Aiven. `src/lib/db.ts:ensureSslmode` injects `sslmode=require` if absent and throws `DATABASE_URL must include sslmode=require for Aiven` for `disable`/`allow` or any non-`require` value |

`src/lib/db.ts` preserves all existing query params and injects the defaults when absent. It reads only `DATABASE_URL`; the legacy `AIVEN_DATABASE_URL` override was removed.

## Connection string

Canonical pattern (order of params is not significant):

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require&connection_limit=5&pool_timeout=15&connect_timeout=15
```

Example (redacted host — use the real Aiven service URI):

```
postgresql://avnadmin:PASSWORD@pg-xxxxx-ew1.aivencloud.com:26974/defaultdb?sslmode=require&connection_limit=5&pool_timeout=15&connect_timeout=15
```

Notes:

- Keep `connection_limit=5`, `pool_timeout=15`, and `connect_timeout=15` aligned with the current Neon runtime.
- `connect_timeout=15` is added automatically if missing; if you already pass a different `connect_timeout`, the code keeps your value.
- Env naming: use `DATABASE_URL` for the active database and `DIRECT_URL` for migrations/backups. `AIVEN_DATABASE_URL` is legacy and ignored.
- Schema stays `provider = "postgresql"` / `env("DATABASE_URL")` in `prisma/schema.prisma`; the runtime override is via `PrismaClient.datasources.db.url` in `src/lib/db.ts` (singleton via `globalThis`).

## pg_trgm + GIN indexes (baseline)

The audited source has **0 GIN indexes**. The historical SQL below is retained for reference only; `20261023000000_add_neon_extensions` creates `pg_trgm` and `pgcrypto` without GIN indexes.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_user_username_trgm  ON "User" USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_email_trgm     ON "User" USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_display_name_trgm ON "User" USING gin ("displayName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mod_name_trgm       ON "Mod" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mod_summary_trgm    ON "Mod" USING gin (summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mod_arabic_title_trgm ON "Mod" USING gin ("arabicTitle" gin_trgm_ops);
```

Verification on the Aiven instance after `migrate deploy`:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%_trgm' ORDER BY 1;
-- expected: 1 extension row + 0 GIN index rows
```

## Cold-start resilience

Aiven can cold-start a few seconds after idle. `src/lib/db.ts:withRetry` / `withDatabaseRetry` / `connectWithRetry` implement exponential backoff **1s → 2s → 4s, max 3 attempts** and wrap any async function (or `prisma.$connect()`). No Neon-specific code is introduced.

```ts
import { withRetry, withDatabaseRetry } from '@/lib/db'
await withDatabaseRetry(() => db.$connect())
// or generic:
await withRetry(() => db.$queryRaw`SELECT 1`)
```

## Raw SQL portability (`src/app/api/admin/reports/stats/route.ts`)

The 5× `db.$queryRaw` calls use only **standard PostgreSQL** functions — portable to Aiven without Neon SDK changes:

- `DATE("createdAt")` — date cast
- `DATE_TRUNC('week', "createdAt")` — truncation
- `TO_CHAR("createdAt", 'YYYY-MM')` — formatting
- `NOW()` — clock
- `AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600)` — interval math
- `COUNT(*)`, `AVG()`, `GROUP BY`, `ORDER BY`

Neon-specific functions or SDK helpers are **not used**. Verified by `src/__tests__/aiven-db.test.ts` (greps the route file for `npg_`/Neon imports and asserts only the allow-list above appears). Code comments in the route note the SQL is standard-PG and 10–50× faster than Prisma aggregation for trend queries.

## See also

- `src/lib/db.ts:1` — singleton + `getDatabaseUrl` / `ensureSslmode` / `withRetry`
- `prisma/schema.prisma:9` — datasource
- `docs/migrations-alignment-runbook.md` — baseline + trgm verification steps

## PITR (Point-in-Time Recovery)

### Enable PITR

Aiven UI → Databases → **Backup & Restore** → **Enable PITR** (toggle ON).

- **Retention policy:** 7 days minimum (Aiven default is 7 days; do not reduce).
- PITR uses continuous WAL archiving — every transaction is captured.
- PITR enablement is instant; first full backup still runs on schedule.

### Restore to point-in-time

**Aiven UI path:**
1. Aiven Console → Service → Databases → Backup & Restore
2. Select the backup to restore from (or choose "Restore to specific time")
3. Enter target timestamp (UTC, ISO 8601 format: `2026-09-13T14:30:00Z`)
4. Confirm restore — creates a new service version with data at that point

**CLI command (aiven CLI):**
```bash
aiven service upgrade --project <PROJECT> --service <SERVICE> \
  --plan upgrade-32GB \
  --restore-backup-to <TARGET_TIME_ISO8601>
```

Verify after restore:
```sql
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
-- Should be < 5 minutes if PITR is healthy
```

### RPO / RTO

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | **5 min** | PITR captures WAL continuously; worst-case data loss is last WAL segment (~5 min) |
| **RTO** (Recovery Time Objective) | **1 h** | Restore from Aiven UI + smoke test + DNS/env swap. Practice with staging clone quarterly |

### Restore drill

Run quarterly on a staging clone:
1. Create Aiven service clone from latest backup
2. Restore to a point 1 hour before "now"
3. Verify data integrity (table counts, row checksums)
4. Run `npx prisma migrate status` against restored DB
5. Time the entire process — target < 1 hour
6. Document results in this section

## Backup strategy

Aiven provides automatic backups, supplemented by manual dumps for off-site safety.

### Aiven auto-backup

- **Daily backups** retained for 7 days (automatic, no configuration needed)
- **PITR WAL archiving** captures all transactions continuously (requires PITR toggle ON above)
- Backups are stored in Aiven's infrastructure (different availability zone)

### Manual pg_dump (weekly cron)

Add a weekly off-site dump as a second safety copy:

```bash
# Weekly cron — every Sunday 03:00 UTC
0 3 * * 0 pg_dump "$DIRECT_URL" | gzip | \
  aws s3 cp - s3://backups-games-arabic/pg-$(date +\%Y\%m\%d).sql.gz
# Or store locally / in a separate cloud provider
```

Verify dump integrity monthly:
```bash
gunzip -t pg-$(date +%Y%m%d).sql.gz && echo "OK"
pg_restore -l pg-$(date +%Y%m%d).sql | head -5  # list archive contents
```

## See also

- `src/lib/db.ts:1` — singleton + `getDatabaseUrl` / `ensureSslmode` / `withRetry`
- `prisma/schema.prisma:9` — datasource
- `docs/migrations-alignment-runbook.md` — baseline + trgm verification steps
- `docs/CUTOVER-CHECKLIST.md` — cutover runbook
- `docs/DEPLOYMENT.md` — deployment guide with Aiven section
