# Staging checklist — single source of truth (deploy-readiness branch)

> Values are NEVER written here — key names + status only. Live validation
> of 2026-09-12 used read-only calls (HTTP codes, no bodies logged).

## §1 Env — VERIFY-in-`.env` table

Local `.env` (gitignored) holds 32 keys. Status from live validation:

| Key | Purpose | Status |
|---|---|---|
| `DATABASE_URL` | Postgres (Neon prod / local dev) | VERIFIED shape (localhost:5432); server down at check time — UNTESTABLE locally |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth public | PRESENT+VALID (`/auth/v1/health` → 200) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API (allowlist checks) | PRESENT+VALID (`/auth/v1/admin/users?limit=1` → 200, read-only) |
| `JWT_SECRET` | Session/MFA/TOTP key root (46 chars) | PRESENT+VALID (length ≥ 32) |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_NAME` / `TELEGRAM_WEBHOOK_SECRET` | Telegram login | PRESENT+VALID (`getMe` ok) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_URL` | Images/files | PRESENT+**INVALID** (`usage` → 401 Invalid credentials) — re-check console values |
| `MEILISEARCH_HOST` | Search (local :7700) | PRESENT+UNTESTABLE (nothing listening) |
| `EMITLO_API_KEY` | Recovery/verification mail | **MISSING** → emitlo.com → API Keys |
| `EMAIL_FROM` | Mail sender identity | **MISSING** → emitlo.com → Domains (verified sender) |
| `FREEIMAGE_API_KEY` | Mod-image uploads | **MISSING** → freeimage.host → account API key |
| `IA_ACCESS_KEY` / `IA_SECRET_KEY` / `IA_IDENTIFIER` | IA multipart uploads | **MISSING** → archive.org/account/s3.php (stay `IA_ENABLED=false` until proof) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate-limit/ban caches | MISSING (empty) → console.upstash.com → Redis → REST credentials. App runs in-memory fallback without them |
| `MEILISEARCH_MASTER_KEY` | Search admin | MISSING (empty) → set own value on the Meili instance |
| `IMG_WORKER_DOMAIN` | Image-proxy worker | MISSING (empty) → Cloudflare dashboard → Workers Routes (see `workers/image-proxy`) |
| `TELEGRAM_CHANNEL_ID` | Channel features | MISSING → BotFather / channel settings |
| `IA_ENABLED` / `NEXT_PUBLIC_IA_ENABLED` | IA kill-switch | `false` (correct pre-staging) |
| `NEXT_PUBLIC_IA_UPLOAD_MODE` | `direct`/`relay`/`multipart` | `multipart` (only takes effect with the flags above) |

Owner actions before staging: (1) revoke Telegram token via BotFather
(live value was committed in `docs/TELEGRAM-AUTH.md` history — redacted
in-tree but rotation still required); (2) fix Cloudinary credentials;
(3) create Resend key + verified sender; (4) FreeImage key; (5) IA keys
only when ready to prove multipart.

## §2 External services (only genuinely unconfigured ones)

- **Supabase allowlist:** Dashboard → Auth → URL Configuration →
  Redirect URLs must include `https://<staging-domain>/api/auth/callback`.
  (`scripts/deploy.sh` prints this reminder; automated check not implemented.)
- **Telegram bot:** exists and valid (`getMe` ok). Only rotation is pending (§1).
- **Resend verified sender:** required before any recovery/verification mail
  can deliver — no email was sent during this work.

## §3 Script usage

```bash
bash scripts/deploy.sh --env-check   # validation only: tree, branch, env (exit 1 + Arabic guidance on gaps)
bash scripts/deploy.sh               # full: checks → migrate deploy → next build → smoke → report
DEPLOY_SKIP_SMOKE=1 bash scripts/deploy.sh   # full without the start+curl smoke
```

Pre-deploy gates inside the script: release branch, clean tree,
`jest --ci`, `tsc --noEmit`, `prisma validate`, `migrate status`.
Smoke curls: `/`→200, `/login`→200, `/creator`→redirect,
`/api/auth/me`→401, `/api/health`→200.

## §4 Manual E2E (staging, human)

- **Auth:** Telegram login → onboarding funnel → recovery email →
  login-03 → MFA enroll (`/admin/security`) → staff redirect enforced.
- **Uploads:** FreeImage image upload; IA multipart with pause + resume →
  assembled (needs §1 IA keys + flags flipped in staging only).
- **Creator:** publisher/translator apply → approve → track permissions;
  comment pin/edit/bulk on own mods.

## §5 Production

Neon **restore-point branch first** (`pre-release-YYYYMMDD`), then
`prisma migrate deploy` (baseline + **9** additive — see
`docs/prod-migration-sync.md` §R1–R3 for the exact history/row counts),
then app deploy, then §R3 verification queries.

## §7 Aiven staging items

> Validate before production cutover. All items must pass on staging clone.

### Connection & SSL
- [ ] Aiven connection string configured with `sslmode=require`
- [ ] `AIVEN_DATABASE_URL` env var set (or `DATABASE_URL` pointing at Aiven)
- [ ] `connection_limit=5`, `pool_timeout=10`, `connect_timeout=10` present
- [ ] `src/lib/db.ts:ensureSslmode` injects defaults correctly (tested)

### PITR
- [ ] PITR enabled on Aiven staging instance
- [ ] First backup completed (check Aiven UI → Backups)
- [ ] Restore drill performed: restore to point-in-time, verify data integrity
- [ ] WAL archiving confirmed healthy (`pg_last_xact_replay_timestamp` < 5 min)

### Migration
- [ ] Baseline + 9 additive migrations applied to Aiven staging
- [ ] `prisma migrate status` → "Database schema is up to date!"
- [ ] Table count matches Neon: 76 tables (73 + 3 new)
- [ ] `pg_trgm` extension + 6 GIN indexes present
- [ ] Row counts verified for User, Mod, ModFile tables

### Smoke test
- [ ] `/` → 200
- [ ] `/login` → 200
- [ ] `/creator` → redirect (or 200 if authenticated)
- [ ] `/api/auth/me` → 401 (unauthenticated)
- [ ] `/api/health` → 200
- [ ] Trigram search functional (`/search?q=test` returns results)

### Cold-start resilience
- [ ] `withRetry` / `withDatabaseRetry` tested (exponential backoff 1s→2s→4s)
- [ ] App recovers from Aiven cold start without user-visible errors

### Rollback
- [ ] Rollback procedure documented and tested
- [ ] Neon branch `pre-cutover-staging` created as restore point
- [ ] Rollback tested: env revert → rebuild → health check passes

## §6 Rollback procedure

1. Promote the §5 Neon branch to primary; re-point app env.
2. Previous app build stays compatible (all 9 migrations additive).
3. Re-run §R3 history query to confirm the restored state.
4. API-key note: post-`07120000` rows authenticate by hash — restored
   pre-migration DBs use the legacy raw column automatically.
