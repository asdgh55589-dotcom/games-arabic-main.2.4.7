# Neon Setup (PostgreSQL 17)

This runbook creates the Neon project used by the app after the Aiven cutover.
It covers PostgreSQL 17, separate `production` / `staging` branches, both
connection strings, and the client-tool check used by backups.

> Never commit real connection strings or credentials. Examples below use
> placeholders only.

## 1. Create the project

1. Sign in at <https://console.neon.tech>.
2. Click **New Project**.
3. Set:
   - **Project name:** `games-arabic` (or your preferred name).
   - **PostgreSQL version:** **17** (do not accept a lower default).
   - **Region:** the same region as the app (for example `AWS eu-west-1`), or
     the closest region to the production runtime.
4. Click **Create project**.

## 2. Create the `production` and `staging` branches

1. Open the project and go to **Branches** (left sidebar).
2. Keep the default branch as the production branch (rename it to
   `production` if it is still called `main`), or create a new branch named
   `production`.
3. Click **New branch** → name it `staging` → create it from `production`.
4. Use the branch selector at the top of the console before copying each
   connection string. `production` and `staging` have different hosts and
   credentials.

## 3. Copy both connection strings

For each branch (start with `production`):

1. Open **Dashboard → Connect** (or the **Connect** button in the branch view).
2. Toggle **Connection pooling**:
   - **On** → copy the **pooled** string for runtime.
   - **Off** → copy the **direct** string for migrations and backups.
3. The pooled host contains `-pooler`; the direct host does not.
   Both use port **5432** (not the legacy `6543`).

Store them as:

| Variable | Connection | Used by |
|----------|------------|---------|
| `DATABASE_URL` | **Pooled** (`-pooler` host) | Prisma runtime / the deployed app |
| `DIRECT_URL` | **Direct** (no `-pooler`) | `prisma migrate deploy`, `pg_dump`, backups |

Keep `sslmode=require` in both URLs. If Neon includes
`channel_binding=require`, keep it.

## 4. Where the variables go

Set both variables in the production environment (Vercel/host secrets and the
runtime container):

- `DATABASE_URL` → pooled Neon URL (the app keeps `connection_limit=5`,
  `pool_timeout=15`, `connect_timeout=15`, `socket_timeout=30`).
- `DIRECT_URL` → direct Neon URL (Prisma `directUrl`, `scripts/weekly-backup.sh`,
  `/api/cron/weekly-backup`, admin backups).
- Remove the legacy `AIVEN_DATABASE_URL` after cutover. It is no longer read
  by `src/lib/db.ts`; leaving it set only leaves stale, misleading config.

`DIRECT_URL` must never contain `-pooler`; backups and migrations reject it.

## 5. Verify the client tools

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

## 6. Cutover environment example

```env
# Runtime only — pooled Neon URL (host contains "-pooler", port 5432)
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connection_limit=5&pool_timeout=15&connect_timeout=15&socket_timeout=30"

# Migrations + backups only — direct Neon URL (no "-pooler", port 5432)
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connect_timeout=15"

# Do NOT set AIVEN_DATABASE_URL after cutover.
```

For the `staging` branch, replace both hosts with that branch's pooled and
direct endpoints from the Neon Console.

## 6.5 Cut over the data (Aiven → Neon)

Use a **fresh Neon branch** (the script refuses a non-empty `public` schema).
Stop all writes to Aiven before running this. The script stays read-only on
Aiven and refuses `--execute` unless `SOURCE_FROZEN=yes` is set.

```bash
SOURCE_URL="postgresql://USER:PASSWORD@aiven-host:PORT/defaultdb?sslmode=require" \
NEON_DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connect_timeout=15" \
SOURCE_FROZEN=yes \
CONFIRM_RESTORE=yes \
./scripts/migrate-to-neon.sh --execute --check-prisma
```

What the script enforces:

- Source ledger must be exactly 19 rows / 18 applied / 1 rolled back (the
  duplicate `20261008000000_team_owner_unique` row) and the backup ledger
  table must have 18 rows. Do **not** apply the new extension migration to
  Aiven first.
- Source and target are both direct (non-`-pooler`) endpoints; encoded or
  trailing-dot pooler hosts are normalized and rejected.
- A `SOURCE_URL` read from `.env` is rejected for `--execute` unless
  `ALLOW_SOURCE_FROM_ENV_FILE=yes` is set.
- TOC table count is 98, extensions are not in the TOC, and
  FUNCTION/VIEW/MATERIALIZED VIEW/TRIGGER/SEQUENCE entries are rejected.
- Restore uses `pg_restore --use-list=... --single-transaction --exit-on-error`
  (not `--list`, which takes no argument).
- After restore, row counts for all 98 tables, object counts (indexes,
  constraints, enums, GIN, sequences, triggers), and the full `_prisma_migrations`
  ledger must match the source before verification is declared passed.
- `--check-prisma` then runs `prisma migrate deploy` against the target and
  verifies the new `20261023000000_add_neon_extensions` row is finished with no
  failed ledger rows.

Keep the source Aiven service untouched until the Neon app smoke tests pass.
Rollback is a configuration change: point `DATABASE_URL` and `DIRECT_URL` back
to Aiven, redeploy, and revoke the Neon credentials/branch.

## 7. Apply migrations and verify

```bash
bun run db:generate
bun run db:migrate:prod   # prisma migrate deploy → uses DIRECT_URL
bun run verify:pg
```

Then run a backup smoke test against the direct URL. The API/lib always writes
locally and uploads with AWS Signature V4 when `BACKUP_S3_ENDPOINT` +
`BACKUP_S3_BUCKET` + both access keys are set; the shell script can use the AWS
credential chain when the keys are omitted:

```bash
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require" \
  ./scripts/weekly-backup.sh --dry-run

DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require" \
  ./scripts/weekly-backup.sh
```

## 8. Cutover checklist

- [ ] Neon project created on PostgreSQL 17 in the chosen region.
- [ ] `production` and `staging` branches exist.
- [ ] Pooled URL stored in `DATABASE_URL`; direct URL stored in `DIRECT_URL`.
- [ ] `AIVEN_DATABASE_URL` removed from production.
- [ ] `bun run verify:pg` passes.
- [ ] `prisma migrate deploy` succeeds against `DIRECT_URL`.
- [ ] A weekly backup completes and its manifest checksum matches.
- [ ] Aiven remains untouched until the Neon smoke tests pass.
