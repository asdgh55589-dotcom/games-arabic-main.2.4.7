# Aiven Cutover Checklist

> Phase 5 — Neon → Aiven PostgreSQL production cutover.
> Each item has a checkbox `[ ]` for tracking. Check off as completed.

## §1 Pre-cutover (before maintenance window)

### Infrastructure readiness
- [ ] Aiven PostgreSQL 16 service provisioned (`eu-west-1`, pool size 5)
- [ ] Aiven service reachable from production host (`psql "$AIVEN_DATABASE_URL" -c "SELECT 1"`)
- [ ] SSL verified (`sslmode=require` enforced by `src/lib/db.ts`)
- [ ] PITR enabled (Aiven UI → Databases → Backup & Restore → Enable PITR)
- [ ] PITR retention set to 7 days minimum
- [ ] First full backup completed (check Aiven UI → Backups)

### Schema & data
- [ ] Baseline + 9 additive migrations applied to Aiven (`prisma migrate status` → "up to date")
- [ ] `pg_trgm` extension + 6 GIN indexes present on Aiven (see `AIVEN-CONFIG.md`)
- [ ] Table count matches Neon: 76 tables (73 baseline + 3 new)
- [ ] Row counts verified for key tables (User, Mod, ModFile)
- [ ] Trigram search tested on Aiven clone

### Scripts & staging
- [ ] Restore drill performed on staging clone (table count, trgm, indexes)
- [ ] `pg_dump` + `pg_restore` tested end-to-end on staging
- [ ] Migration scripts tested on staging clone
- [ ] Smoke test results on Aiven staging: `/`→200, `/login`→200, `/api/health`→200
- [ ] App cold-start resilience tested (`withRetry` / `withDatabaseRetry`)

### Team & process
- [ ] Team notified of maintenance window (date, time, duration)
- [ ] Rollback procedure documented and reviewed (see §4)
- [ ] Env vars prepared: `AIVEN_DATABASE_URL` set in production env
- [ ] `DATABASE_URL` ready to swap (either Neon or Aiven — both work with `src/lib/db.ts`)
- [ ] Off-site `pg_dump` taken of Neon as final safety copy

## §2 During cutover (maintenance window)

### Data migration
- [ ] **Step 1:** Final `pg_dump` from Neon: `pg_dump "$DATABASE_URL" | gzip > final-neon-dump.sql.gz`
- [ ] **Step 2:** Restore to Aiven: `gunzip -c final-neon-dump.sql.gz | psql "$AIVEN_DATABASE_URL"`
- [ ] **Step 3:** Apply any pending migrations: `AIVEN_DATABASE_URL=<url> npx prisma migrate deploy`
- [ ] **Step 4:** Verify schema parity:
  ```sql
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name != '_prisma_migrations';
  -- expected: 76
  ```
- [ ] **Step 5:** Verify trigram indexes:
  ```sql
  SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%_trgm' ORDER BY 1;
  -- expected: 6 rows
  ```
- [ ] **Step 6:** Verify migrations history:
  ```sql
  SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name;
  -- expected: baseline + 9 additive = 10 rows
  ```

### Application switch
- [ ] **Step 7:** Update `AIVEN_DATABASE_URL` env var (or swap `DATABASE_URL` to point at Aiven)
- [ ] **Step 8:** Rebuild app: `bun run build`
- [ ] **Step 9:** Start app and verify health: `curl https://yourdomain.com/api/health` → 200
- [ ] **Step 10:** Smoke test:
  - `/` → 200
  - `/login` → 200
  - `/creator` → redirect (or 200 if logged in)
  - `/api/auth/me` → 401 (unauthenticated)
  - `/api/health` → 200
- [ ] **Step 11:** Test key user flows:
  - Login (Telegram/Google/Discord)
  - Mod listing and search (trigram)
  - Upload flow
  - Admin panel access

### Monitoring
- [ ] **Step 12:** Monitor error logs for 30 minutes post-switch
- [ ] **Step 13:** Check connection pool metrics (no queuing, no timeouts)
- [ ] **Step 14:** Verify no increase in 5xx errors

## §3 Post-cutover (first 24 hours)

- [ ] Monitor application logs for errors (24h minimum)
- [ ] Verify PITR is capturing WAL (Aiven UI → Backup & Restore → last backup time)
- [ ] Check Aiven service metrics (CPU, memory, connections, disk usage)
- [ ] Verify SSL connections working (`sslmode=require` enforced)
- [ ] Run `npx prisma migrate status` → "Database schema is up to date!"
- [ ] Verify search functionality (trigram indexes performing)
- [ ] Confirm backup schedule (daily auto-backup + weekly manual pg_dump)
- [ ] Keep Neon database alive for 7 days (rollback safety net)
- [ ] Schedule Neon decommission after 7-day safety period

## §4 Rollback procedure

> If cutover fails or critical issues are found, execute within 30 minutes.

### Option A: Restore Neon from branch (preferred)
1. Neon dashboard → project → Branches → promote `pre-cutover-YYYYMMDD` branch to primary
2. Revert `DATABASE_URL` env var to Neon connection string
3. Rebuild and restart app: `bun run build && node .next/standalone/server.js`
4. Verify: `curl https://yourdomain.com/api/health` → 200
5. Notify team: "Rolled back to Neon. Aiven cutover deferred."

### Option B: Restore from pg_dump (if branch unavailable)
1. Restore from off-site dump: `gunzip -c final-neon-dump.sql.gz | psql "$NEON_DATABASE_URL"`
2. Apply migrations if needed: `npx prisma migrate deploy`
3. Revert env vars, rebuild, restart
4. Verify health and key flows

### Rollback triggers
- Health check fails after 5 minutes
- > 10x increase in error rate
- Data integrity check fails (row count mismatch > 1%)
- Connection pool exhaustion (all 5 connections in use, queries queuing)

### Post-rollback
- [ ] Document root cause of cutover failure
- [ ] Fix issue in staging
- [ ] Re-schedule cutover with updated checklist

## §5 Neon decommission (after 7-day safety period)

- [ ] Confirm 7 days elapsed since successful cutover
- [ ] Final verification: Aiven serving all traffic, no errors
- [ ] Take final `pg_dump` from Neon for archival
- [ ] Delete Neon project (or downgrade to free tier)
- [ ] Update `DATABASE_URL` env var to remove Neon reference
- [ ] Remove Neon-specific docs references (keep as historical notes)

## See also

- `docs/AIVEN-CONFIG.md` — PITR, backup strategy, connection string, pool tuning
- `docs/DEPLOYMENT.md` — deployment guide with Aiven section
- `docs/prod-migration-sync.md` — Neon migration history and baseline squash
- `docs/staging-checklist.md` — staging validation including Aiven items
