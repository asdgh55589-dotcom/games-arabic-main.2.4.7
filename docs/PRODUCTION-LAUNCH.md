# Production Launch Checklist

> Master checklist for production launch. Merges staging-checklist, CUTOVER-CHECKLIST, and CRON-JOBS docs into a single source of truth.

## §1 Pre-launch (staging week)

### Env verification

| Key | Purpose | Status |
|---|---|---|
| `DATABASE_URL` | Postgres (Aiven primary / Neon fallback) | |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth public | |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API (allowlist checks) | |
| `JWT_SECRET` | Session/MFA/TOTP key root (≥32 chars) | |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_NAME` / `TELEGRAM_WEBHOOK_SECRET` | Telegram login | |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_URL` | Images/files | |
| `MEILISEARCH_HOST` | Search | |
| `EMITLO_API_KEY` | Recovery/verification mail | |
| `EMAIL_FROM` | Mail sender identity | |
| `FREEIMAGE_API_KEY` | Mod-image uploads | |
| `IA_ACCESS_KEY` / `IA_SECRET_KEY` / `IA_IDENTIFIER` | IA multipart uploads | |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate-limit/ban caches | |
| `IMG_WORKER_DOMAIN` | Image-proxy worker | |
| `TELEGRAM_CHANNEL_ID` | Channel features | |
| `IA_ENABLED` / `NEXT_PUBLIC_IA_ENABLED` | IA kill-switch | |

### External services

- [ ] Supabase redirect URLs include `https://<domain>/api/auth/callback`
- [ ] Telegram bot exists and valid (`getMe` ok)
- [ ] Resend verified sender configured
- [ ] FreeImage key active
- [ ] IA keys ready (only if `IA_ENABLED=true`)

### Aiven staging items

- [ ] Aiven connection string with `sslmode=require`, `connection_limit=5`, `pool_timeout=10`, `connect_timeout=10`
- [ ] PITR enabled, first backup completed
- [ ] Baseline + 9 additive migrations applied
- [ ] Table count matches: 76 tables (73 + 3 new)
- [ ] `pg_trgm` extension + 6 GIN indexes present
- [ ] Smoke test: `/`→200, `/login`→200, `/creator`→redirect, `/api/auth/me`→401, `/api/health`→200
- [ ] Cold-start resilience tested (`withRetry` / `withDatabaseRetry`)
- [ ] Rollback procedure documented and tested

### Build verification

- [ ] `bun run build` passes (prisma generate → migrate deploy → next build → copy static)
- [ ] `bun run lint` passes
- [ ] `tsc --noEmit` passes
- [ ] `npx prisma validate` passes
- [ ] Standalone output at `.next/standalone/server.js`

### Scripts

- [ ] `scripts/preflight.sh` exists and is executable
- [ ] `scripts/deploy.sh` exists and passes `--env-check`
- [ ] `scripts/weekly-backup.sh` exists and passes `--dry-run`

## §2 Cutover day

### Pre-cutover

- [ ] Aiven PostgreSQL 16 service provisioned (`eu-west-1`, pool size 5)
- [ ] Aiven service reachable from production host
- [ ] SSL verified (`sslmode=require` enforced by `src/lib/db.ts`)
- [ ] Team notified of maintenance window

### Data migration

- [ ] **Step 1:** Final `pg_dump` from Neon: `pg_dump "$DATABASE_URL" | gzip > final-neon-dump.sql.gz`
- [ ] **Step 2:** Restore to Aiven: `gunzip -c final-neon-dump.sql.gz | psql "$AIVEN_DATABASE_URL"`
- [ ] **Step 3:** Apply pending migrations: `AIVEN_DATABASE_URL=<url> npx prisma migrate deploy`
- [ ] **Step 4:** Verify schema parity (76 tables)
- [ ] **Step 5:** Verify trigram indexes (6 rows)
- [ ] **Step 6:** Verify migration history (baseline + 9 additive = 10 rows)

### Application switch

- [ ] **Step 7:** Update `AIVEN_DATABASE_URL` env var (or swap `DATABASE_URL`)
- [ ] **Step 8:** Rebuild app: `bun run build`
- [ ] **Step 9:** Start app and verify health: `curl https://yourdomain.com/api/health` → 200
- [ ] **Step 10:** Smoke test: `/`→200, `/login`→200, `/creator`→redirect, `/api/auth/me`→401, `/api/health`→200
- [ ] **Step 11:** Test key user flows: login, mod listing/search, upload, admin panel

### Monitoring

- [ ] **Step 12:** Monitor error logs for 30 minutes post-switch
- [ ] **Step 13:** Check connection pool metrics (no queuing, no timeouts)
- [ ] **Step 14:** Verify no increase in 5xx errors

## §3 Post-cutover (7-day safety)

### First 24 hours

- [ ] Monitor application logs for errors (24h minimum)
- [ ] Verify PITR is capturing WAL (Aiven UI → Backup & Restore → last backup time)
- [ ] Check Aiven service metrics (CPU, memory, connections, disk usage)
- [ ] Verify SSL connections working (`sslmode=require` enforced)
- [ ] Run `npx prisma migrate status` → "Database schema is up to date!"
- [ ] Verify search functionality (trigram indexes performing)
- [ ] Confirm backup schedule (daily auto-backup + weekly manual pg_dump)

### 7-day safety period

- [ ] Keep Neon database alive for 7 days (rollback safety net)
- [ ] Schedule Neon decommission after 7-day safety period
- [ ] After 7 days: final `pg_dump` from Neon, delete Neon project, update env vars

### Rollback triggers

If any of these occur within 7 days, execute rollback:

- Health check fails after 5 minutes
- > 10x increase in error rate
- Data integrity check fails (row count mismatch > 1%)
- Connection pool exhaustion (all 5 connections in use, queries queuing)

## §4 Owner manual actions

| # | Action | Where | Status |
|---|--------|-------|--------|
| 1 | Set `CRON_SECRET` | `.env` + cron-job.org | |
| 2 | Create 4 cron jobs (image-health, promote-tiers, backup-cleanup, weekly-backup) | cron-job.org | |
| 3 | CF SSL Full Strict + `wrangler deploy` | Cloudflare | |
| 4 | PostHog key | PostHog UI | |
| 5 | Clarity ID | Clarity UI | |
| 6 | OpenObserve endpoint | OpenObserve UI | |
| 7 | Emitlo DNS + key | emitlo.com | |
| 8 | Aiven database | Aiven console | |
| 9 | Cloudinary flip | Cloudinary dashboard | |
