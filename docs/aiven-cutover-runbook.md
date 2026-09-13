# Aiven Cutover Runbook — Neon → Aiven (FULL data migration)

> **DOCS ONLY.** Nothing here has been executed against production.
> Run steps IN ORDER during a maintenance window. Estimated: 20-30 min.

## Prerequisites

- `pg_dump` / `pg_restore` / `psql` installed locally (PostgreSQL 14+ client tools)
- Aiven PostgreSQL 16 service created and accessible
- Neon project still running as primary
- App in maintenance mode or DNS pointed away (no writes during migration)
- Owner access to both Neon dashboard and Aiven dashboard
- `sslmode=require` enforced on Aiven connection string

## Step 0: Aiven Setup (owner — manual, pre-runbook)

1. **Create Aiven PostgreSQL 16 service:**
   - Region: `eu-west-1`
   - Plan: Startup-4 or higher (adjust based on data size)
   - **PITR enabled** with 7-day retention

2. **Get connection string:**
   - Aiven Console → Service → Overview → Connection Information
   - Copy the `postgresql://` URL with `sslmode=require`
   - Store as `$AIVEN_DATABASE_URL` (do NOT commit)

3. **Verify Aiven is reachable:**
   ```bash
   psql "$AIVEN_DATABASE_URL" -c "SELECT version();"
   # Expected: PostgreSQL 16.x
   ```

4. **Install `pg_trgm` extension on Aiven** (done automatically by pg_restore if present, but verify):
   ```bash
   psql "$AIVEN_DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
   ```

## Step 1: Neon Restore Point

Create an instant branch in Neon as a safety net:

1. Neon Console → project → Branches → **Create branch**
2. Branch name: `pre-release-YYYYMMDD` (use today's date)
3. Branch from: `main`
4. **Do NOT promote** — this is a restore point only

## Step 2: pg_dump from Neon

Full schema + data dump with safe flags:

```bash
# Set your Neon connection string
NEON_DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech:5432/dbname?sslmode=require"

pg_dump \
  "$NEON_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --verbose \
  --file="/tmp/neon-full-$(date +%Y%m%d).dump"
```

**Flags explained:**
- `--format=custom` — compressed, allows selective restore
- `--no-owner` — Aiven user owns objects (not Neon user)
- `--no-privileges` — avoids GRANT failures on different role hierarchy
- `--schema=public` — only public schema (avoids system schemas)

**Expected output:** dump file 10-50 MB depending on data volume. Verify non-zero size:
```bash
ls -lh /tmp/neon-full-YYYYMMDD.dump
```

## Step 3: pg_restore to Aiven

```bash
# Set your Aiven connection string
AIVEN_DATABASE_URL="postgresql://avnadmin:pass@xxx.aivencloud.com:12345/dbname?sslmode=require"

pg_restore \
  "$AIVEN_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --verbose \
  --clean \
  --if-exists \
  /tmp/neon-full-YYYYMMDD.dump
```

**Flags explained:**
- `--clean --if-exists` — drops objects before recreating (idempotent re-runs)
- `--no-owner --no-privileges` — same as dump, avoids permission errors
- `--verbose` — progress output

**Expected duration:** 5-15 min depending on data size.

**If pg_restore fails:**
```bash
echo "ROLLBACK: Restore Neon branch as primary, revert DATABASE_URL"
echo "See Step 7 below."
```

## Step 4: Verify Migration

Run these queries against Aiven:

```bash
# Table count (should be 76 — 53 models + junction/lookup tables)
psql "$AIVEN_DATABASE_URL" -c "
  SELECT count(*) AS table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name != '_prisma_migrations';
"
# Expected: 76

# Prisma migrations match Neon baseline
psql "$AIVEN_DATABASE_URL" -c "
  SELECT migration_name, finished_at, rolled_back_at
  FROM \"_prisma_migrations\"
  ORDER BY migration_name;
"
# Expected: baseline + 9 additive migrations (10 rows), all finished_at set, rolled_back_at NULL

# pg_trgm extension
psql "$AIVEN_DATABASE_URL" -c "
  SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
"
# Expected: 1 row

# 6 trigram indexes
psql "$AIVEN_DATABASE_URL" -c "
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public' AND indexname LIKE 'idx_%_trgm'
  ORDER BY indexname;
"
# Expected: 6 rows:
#   idx_mod_arabic_title_trgm
#   idx_mod_name_trgm
#   idx_mod_summary_trgm
#   idx_user_display_name_trgm
#   idx_user_email_trgm
#   idx_user_username_trgm

# Smoke test: count a few key tables
psql "$AIVEN_DATABASE_URL" -c "
  SELECT
    (SELECT count(*) FROM \"User\") AS users,
    (SELECT count(*) FROM \"Mod\") AS mods,
    (SELECT count(*) FROM \"Game\") AS games;
"
# Expected: non-zero counts (data migrated)
```

## Step 5: Update DATABASE_URL in Production (owner action)

1. **Stop app** (maintenance mode or kill running instances)
2. **Update env:**
   - Set `DATABASE_URL` to `$AIVEN_DATABASE_URL` (with `?connection_limit=5&pool_timeout=10&sslmode=require`)
   - Set `DIRECT_URL` to same Aiven URL (for `prisma migrate`)
3. **Restart app**
4. **Verify app connects:** `curl https://yourdomain.com/api/health`

## Step 6: Prisma Migrate Status

```bash
# With new DATABASE_URL pointing to Aiven
npx prisma migrate status
# Expected: "Database schema is up to date!"
```

If it reports pending migrations — **STOP, investigate** before proceeding.

## Step 7: Rollback Plan

If anything goes wrong after cutover:

1. **Restore Neon branch** as primary:
   - Neon Console → Branches → `pre-release-YYYYMMDD` → Promote to primary
2. **Revert env:**
   - Set `DATABASE_URL` back to Neon connection string
   - Set `DIRECT_URL` back to Neon connection string
3. **Restart app**
4. **Notify team** — data written to Aiven during the window is LOST (that's why maintenance mode matters)
5. **Post-mortem:** document what failed, update this runbook

## Post-Cutover Checklist

- [ ] Aiven PITR retention confirmed (7 days)
- [ ] `prisma migrate status` → up to date
- [ ] App health endpoint returns 200
- [ ] Neon branch `pre-release-YYYYMMDD` preserved (delete after 7 days if no issues)
- [ ] `pg_dump` file archived off-site
- [ ] Team notified of successful cutover

---

*Runbook created by SA-2. Arabic byte-identical. No production writes.*
