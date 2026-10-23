# Production Launch Checklist

> Master checklist for production launch. Merges staging-checklist and
> CRON-JOBS docs into a single source of truth.

## §1 Pre-launch (staging week)

### Env verification

| Key | Purpose | Status |
|---|---|---|
| `DATABASE_URL` | Postgres (Neon pooled runtime) | |
| `DIRECT_URL` | Postgres (Neon direct — migrations/backups) | |
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

### Neon staging verification

- [ ] `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) set for the staging branch
- [ ] `sslmode=require`, `connection_limit=5`, `pool_timeout=15`, `connect_timeout=15`, `socket_timeout=30`
- [ ] Neon restore window confirmed (7 days minimum)
- [ ] All migrations applied (`prisma migrate status` → up to date)
- [ ] Table count matches production: **98 public base tables**
- [ ] `pg_trgm` + `pgcrypto` present; **0 GIN indexes**
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

## §2 Deploy day (Neon)

### Pre-deploy

- [ ] Neon restore branch created (`pre-release-YYYYMMDD`)
- [ ] `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) verified in the host secrets
- [ ] Team notified of the maintenance window
- [ ] Off-site `pg_dump` taken as a second safety copy

### Migrations

- [ ] **Step 1:** Apply migrations: `bun run db:migrate:prod`
- [ ] **Step 2:** `npx prisma migrate status` → "Database schema is up to date!"
- [ ] **Step 3:** Verify schema parity: **98** public base tables
- [ ] **Step 4:** Verify **0 GIN indexes** and `pg_trgm` + `pgcrypto` extensions
- [ ] **Step 5:** Verify `_prisma_migrations` has no failed rows

### Application deploy

- [ ] **Step 6:** Build app: `bun run build`
- [ ] **Step 7:** Deploy and verify health: `curl https://yourdomain.com/api/health` → 200
- [ ] **Step 8:** Smoke test: `/`→200, `/login`→200, `/creator`→redirect, `/api/auth/me`→401, `/api/health`→200
- [ ] **Step 9:** Test key user flows: login, mod listing/search, upload, admin panel

### Monitoring

- [ ] **Step 10:** Monitor error logs for 30 minutes post-deploy
- [ ] **Step 11:** Check connection pool metrics (no queuing, no `P2024`)
- [ ] **Step 12:** Verify no increase in 5xx errors

## §3 Post-deploy (7-day safety)

### First 24 hours

- [ ] Monitor application logs for errors (24h minimum)
- [ ] Verify Neon restore history is capturing changes (Console → Branches → Restore)
- [ ] Check Neon compute metrics (CPU, memory, connections)
- [ ] Verify SSL connections working (`sslmode=require` enforced)
- [ ] Run `npx prisma migrate status` → "Database schema is up to date!"
- [ ] Verify search functionality (trigram without GIN indexes on 98 tables)
- [ ] Confirm backup schedule (weekly manual `pg_dump` + restore history)

### 7-day safety period

- [ ] Keep the `pre-release-YYYYMMDD` restore branch for 7 days
- [ ] Run one full backup and verify its manifest checksum
- [ ] After 7 days, delete the temporary restore branch and update this checklist

### Rollback triggers

If any of these occur within 7 days, execute the incident rollback in
`docs/NEON-SETUP.md` §8:

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
| 8 | Neon database | Neon console | |
| 9 | Cloudinary flip | Cloudinary dashboard | |
