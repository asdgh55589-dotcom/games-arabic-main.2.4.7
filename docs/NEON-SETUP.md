# Neon Operations (PostgreSQL 17)

> Single source of truth for day-2 Neon operations. Neon is the live production database;
> the legacy migration is complete. For deployment steps see
> `docs/DEPLOYMENT.md`, for backup policy see `docs/BACKUP-STRATEGY.md`, and for
> schema history see `docs/DATABASE.md`.

> Never commit real connection strings or credentials. Examples below use
> placeholders only.

## 1. Current state

| Item | Current value |
|------|---------------|
| Engine | PostgreSQL 17 |
| Role | Live primary (production + staging branches) |
| Public base tables | **98** (excluding `_prisma_migrations`) |
| GIN indexes | **0** |
| Extensions | `pg_trgm`, `pgcrypto` |
| Runtime URL | `DATABASE_URL` (pooled, host contains `-pooler`) |
| Migrations / backups URL | `DIRECT_URL` (direct, never `-pooler`) |
| Pool tuning | `connection_limit=5`, `pool_timeout=15`, `connect_timeout=15`, `socket_timeout=30` |
| Migrations directory | `prisma/migrations/` (19 migrations, baseline squash first) |
| Latest migration | `20261023000000_add_neon_extensions` |

`src/lib/db.ts` reads only `DATABASE_URL`. There is no secondary database
override; remove any stale database URL variables that are not
`DATABASE_URL` / `DIRECT_URL`.

## 2. Branch model

| Branch | Purpose |
|--------|---------|
| `production` | Serves production traffic |
| `staging` | Pre-release validation, branched from `production` |
| `pre-release-YYYYMMDD` | Short-lived restore point created before each release |
| `incident-YYYYMMDD-HHmm` | Short-lived restore point created during an incident |

Create restore branches from the Neon Console **Branches** page or with
`neonctl branches create`. Never promote a restore branch unless you are
executing the incident rollback in §8.

## 3. Connection strings and environment variables

Copy both strings from **Dashboard → Connect** for the selected branch:

| Variable | Connection | Used by |
|----------|------------|---------|
| `DATABASE_URL` | **Pooled** (`-pooler` host, port 5432) | Prisma runtime / the deployed app |
| `DIRECT_URL` | **Direct** (no `-pooler`, port 5432) | `prisma migrate deploy`, `pg_dump`, backups |

```env
# Runtime only — pooled Neon URL
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connection_limit=5&pool_timeout=15&connect_timeout=15&socket_timeout=30"

# Migrations + backups only — direct Neon URL
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connect_timeout=15"
```

Rules:

- Keep `sslmode=require` in both URLs.
- Do **not** add `channel_binding=require` (Prisma 6 fails with P1001) or
  `sslmode=verify-full` / `verify-ca`.
- Keep `connection_limit=5`; a larger value oversubscribes the Neon pool.
- `DIRECT_URL` must never contain `-pooler`; backups and migrations reject it.
- Do not use port `6543` or `pgbouncer=true` unless prepared-statement errors
  are actually observed.

Set both variables in the production environment (Vercel/host secrets and the
runtime container). Env changes apply to the next deployment, not the live one.

## 4. Verify the PostgreSQL client tools

Backups require PostgreSQL 17 client tools (`pg_dump`, `pg_restore`, `psql`):

```bash
bun run verify:pg
```

The command exits non-zero if any tool is missing or older than 17. If you do
not have them locally, use the official image:

```bash
docker run --rm -v "$PWD":/work -w /work postgres:17 pg_dump --version
```

The production Docker image installs `postgresql17-client`.

> Backups shell out to `pg_dump` at runtime. Run the cron route/lib on the
> project Docker image (or another host with PostgreSQL 17 client tools); a
> serverless runtime without `pg_dump` returns a 500 with remediation text.

## 5. Migrations

```bash
bun run db:generate
bun run db:migrate:prod   # prisma migrate deploy -> uses DIRECT_URL
npx prisma migrate status
```

Expected state:

- `prisma migrate status` reports **Database schema is up to date!**
- The `_prisma_migrations` ledger has no failed rows; the duplicate
  `20261008000000_team_owner_unique` entry stays rolled back.
- `public` has **98** base tables (excluding `_prisma_migrations`).
- `pg_trgm` and `pgcrypto` exist; 0 GIN indexes are expected.

Guardrails:

- Use `prisma migrate deploy` in production, never `db push` or `migrate reset`.
- Generate new migrations with `prisma migrate dev --create-only --name <change>`
  and review the SQL before applying.
- Keep migrations additive unless an owner-approved plan says otherwise.
- `20261023000000_add_neon_extensions` creates `pg_trgm` + `pgcrypto` and
  intentionally creates no GIN indexes.
- See `prisma/migrations/README.md` for the full migration checklist.

### Verify the schema

```sql
-- Table count: expected 98
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name <> '_prisma_migrations';

-- Extensions: expected pg_trgm and pgcrypto
SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'pgcrypto') ORDER BY 1;

-- GIN indexes: expected 0 rows
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexdef ILIKE '%USING gin%'
ORDER BY 1;

-- Ledger: no failed migrations
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
ORDER BY migration_name;
```

## 6. Backups

Two independent layers:

1. **Neon restore history** — continuous branch history. Retention is
   plan-dependent; confirm it under **Project settings → History retention**
   and keep at least 7 days.
2. **Weekly `pg_dump`** — portable off-site copy written by
   `scripts/weekly-backup.sh` (see `docs/BACKUP-STRATEGY.md`).

Run a backup smoke test against the direct URL:

```bash
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require" \
  ./scripts/weekly-backup.sh --dry-run

DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require" \
  ./scripts/weekly-backup.sh
```

Backup rules:

- `scripts/weekly-backup.sh` reads `DIRECT_URL` only and rejects `-pooler`
  hosts; it never falls back to `DATABASE_URL`.
- Set `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`,
  `BACKUP_S3_ACCESS_KEY`, and `BACKUP_S3_SECRET_KEY` for off-site uploads
  (AWS SigV4; S3-compatible storage works). Without endpoint + bucket the dump
  stays local only.
- Verify the manifest SHA256 after every restore drill.
- Never back up through the pooled endpoint.

## 7. Verification

Smoke checks after a deploy or configuration change:

```bash
BASE="https://<production-domain>"
curl -fsS -o /dev/null -w 'health %{http_code}\n' "$BASE/api/health"      # 200
curl -fsS -o /dev/null -w 'mods %{http_code}\n' "$BASE/api/mods?limit=1"  # 200 (DB read path)
curl -fsS -o /dev/null -w 'login %{http_code}\n' "$BASE/login"           # 200
curl -s  -o /dev/null -w 'me %{http_code}\n' "$BASE/api/auth/me"         # 401
curl -s  -o /dev/null -w 'creator %{http_code}\n' "$BASE/creator"        # 307/308
```

`/api/health` is dependency-free by design, so `/api/mods?limit=1` is the
actual database-read proof. Then verify:

- With `DATABASE_URL` + `DIRECT_URL` exported locally:
  `bun run db:migrate:prod` → no pending migrations.
- `./scripts/weekly-backup.sh --dry-run` → exit 0 (no DB/S3 access).
- Admin session: `/api/health/detailed` → database `ok` (no `P2024`/pool
  exhaustion).
- Log in, search, open a mod, and perform one auth-gated action; watch logs
  and error rates for 30 minutes.

## 8. Incident checklist

### App cannot reach the database

1. Confirm `DATABASE_URL` is the pooled Neon URL and `DIRECT_URL` is direct.
2. Check Neon Console → **Monitoring** for connection saturation and compute
   status.
3. Confirm `connection_limit=5`; reduce concurrent jobs if the pool is
   saturated.
4. Look for `P2024` / `P1001` in logs and the `/api/health/detailed` database
   block.
5. If the compute is suspended, wake it and retry.

### Migration failed

1. Stop the deployment; do not retry blindly.
2. Copy the failing SQL and the `_prisma_migrations` row.
3. Create an incident restore branch at the last known-good timestamp.
4. Fix forward only after the failure is understood; otherwise promote the
   restore branch (§8 rollback).

### Data loss or corruption

1. Create a restore branch at the last known-good timestamp in the Neon
   Console (**Branches → Restore**).
2. Validate row counts on the restored branch (98 public tables, spot-check
   `User`, `Mod`, `ModFile`).
3. Promote the restored branch to primary.
4. Deploy the matching app build and re-run the §7 smoke checks.
5. Reconcile any writes made after the restore point explicitly.

### Backup failure

1. Run `bash -n scripts/weekly-backup.sh` and
   `./scripts/weekly-backup.sh --dry-run`.
2. Confirm `DIRECT_URL` is set, direct, and reachable.
3. Confirm PostgreSQL 17 client tools (`bun run verify:pg`).
4. Check S3/R2 credentials only when `BACKUP_S3_*` is configured.
5. Re-run the backup and verify the manifest checksum.

### Credential leak

1. Rotate the Neon role password in the Neon Console.
2. Update `DATABASE_URL` / `DIRECT_URL` in the secret store.
3. Redeploy; env changes apply to the next deployment.
4. Revoke the old credentials and review access logs.

### After any incident

- Keep the restore branch and backup evidence until the review closes.
- Record the timeline, root cause, and verification output.
- Update this runbook and `docs/BACKUP-STRATEGY.md` with anything learned.
