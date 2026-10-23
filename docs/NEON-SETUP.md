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

Keep `sslmode=require` in both URLs. Do **not** add
`channel_binding=require` — Prisma 6 fails with P1001; use `sslmode=require`
only. Both URLs use port **5432**.

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
  constraints, enums, GIN (expected 0 on the audited source), sequences, triggers), and the full `_prisma_migrations`
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
- [ ] Aiven data remains unchanged until the Neon smoke tests pass; rollback skips migrations so its ledger stays 19/18/1.

## 9. Go-Live checklist (final)

§8 is the pre-flight checklist. This section is the execution order for the
30-minute cutover window. Keep the Aiven service online and its data unchanged: it is the
rollback target for the whole window. Rollback deploys skip Prisma migrations so Aiven's
ledger stays 19/18/1 and a retry is not blocked by the source-ledger guard. If restore + smoke tests cannot finish in
30 minutes, roll back (§9.5) instead of extending the outage.

### 9.1 T-0: freeze Aiven writes and pause every scheduler

Do these in order. Do not start the dump until both are complete.

1. **Pause every external scheduler first.** See §9.7 for the exact evidence.
   `vercel.json` has no `crons` block, so the documented external scheduler is
   cron-job.org (`docs/PRODUCTION-LAUNCH.md` §4). If the Vercel dashboard has
   Cron Jobs configured outside the repo, disable those too.
2. **Take production offline so it cannot write to Aiven:**
   - Vercel: `vercel project pause` (interactive; confirm the project name) or
     Dashboard → Project → Settings → General → Pause Project.
   - Docker/VM: stop the app process/container.
   Visitors get 503 while paused; Aiven stays reachable for the dump.
3. **Confirm no active DDL/DML remains** (read-only query; the migration script
   repeats this and refuses to continue unless it sees `0`):

   ```bash
   psql "$SOURCE_URL" -c "SELECT count(*) FROM pg_stat_activity
     WHERE datname = current_database() AND pid <> pg_backend_pid()
       AND state = 'active'
       AND query ~* '^[[:space:]]*(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|comment|copy)[[:space:]]';"
   ```

   Expected: `0`. Do **not** set `ALLOW_ACTIVE_SOURCE=yes`.

### 9.2 Restore and verify (scripted)

Use a fresh Neon branch and the §6.5 command; the script is read-only on Aiven
and aborts unless the source is frozen:

```bash
SOURCE_URL="postgresql://USER:PASSWORD@aiven-host:PORT/defaultdb?sslmode=require" \
NEON_DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connect_timeout=15" \
SOURCE_FROZEN=yes \
CONFIRM_RESTORE=yes \
./scripts/migrate-to-neon.sh --execute --check-prisma
```

Pass criteria (enforced by the script):

- restore uses `pg_restore --single-transaction --exit-on-error`;
- 98-table row-count parity, object-count parity, and the full
  `_prisma_migrations` ledger match the source;
- `--check-prisma` applies `20261023000000_add_neon_extensions` and leaves no
  failed ledger row.

If any check fails, stop: resume Aiven traffic (roll back, §9.5) and
investigate. Do not deploy a partially verified restore.

### 9.3 Update the production environment (Vercel CLI)

Run from the repo root after `vercel link`. **Before removing anything, record
the current Aiven `DATABASE_URL` and `DIRECT_URL` in the team vault** — those
are the rollback values. Never print or commit them.

```bash
vercel env rm DATABASE_URL production --yes || true
vercel env add DATABASE_URL production   # paste the POOLED Neon URL at the prompt
vercel env rm DIRECT_URL production --yes || true
vercel env add DIRECT_URL production     # paste the DIRECT Neon URL at the prompt
vercel env rm AIVEN_DATABASE_URL production --yes || true
vercel env ls production                 # names only; AIVEN_DATABASE_URL must be gone
```

Use these exact shapes (both port **5432**):

```env
# Runtime only — pooled host contains "-pooler".
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connection_limit=5&pool_timeout=15&connect_timeout=15&socket_timeout=30"

# Migrations + backups only — direct host, never "-pooler".
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/games_arabic?sslmode=require&connect_timeout=15"
```

Rules:

- `sslmode=require` only. **Remove `channel_binding=require` if the Neon
  console copied it** — Prisma 6 fails with P1001. Do not use
  `sslmode=verify-full` / `verify-ca`; Prisma 6 rejects them.
- `src/lib/db.ts` injects `connect_timeout=15`, `pool_timeout=15`,
  `connection_limit=5`, and `socket_timeout=30` when missing. Set them
  explicitly in `DATABASE_URL` anyway so the deployed value is auditable.
- Keep `connection_limit=5`; a larger value oversubscribes the Neon pool.
- `DIRECT_URL` is mandatory (`prisma/schema.prisma` `directUrl`) and must not
  contain `-pooler`. Do not use port `6543` or `pgbouncer=true` unless you
  actually hit prepared-statement errors.
- Remove `AIVEN_DATABASE_URL`. No runtime code reads it (tests assert it is
  ignored); leaving it set only leaves stale, misleading config.

**Vercel dashboard alternative:** Project → Settings → Environment Variables →
Production → edit `DATABASE_URL` / `DIRECT_URL` and remove
`AIVEN_DATABASE_URL`. Sensitive values are write-only (paste, do not expect to
read them back). Env changes apply to the **next** deployment, not the live one.

### 9.4 Deploy and production smoke tests

```bash
vercel --prod
vercel project resume   # interactive; the new deployment now serves Neon
```

`vercel --prod` is required after env changes; Vercel does not mutate the live
deployment. If the build fails, production stays paused on the old Aiven
configuration — fix and redeploy without resuming.

Run these immediately after `vercel project resume`:

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

- With the Neon `DATABASE_URL` + `DIRECT_URL` exported locally (both are
  required by Prisma): `bun run db:migrate:prod` → no pending migrations.
- `./scripts/weekly-backup.sh --dry-run` → exit 0 (no DB/S3 access).
- Admin session: `/api/health/detailed` → database `ok` (no `P2024`/pool
  exhaustion).
- Log in, search, open a mod, and perform one auth-gated action; watch Vercel
  logs and error rates for 30 minutes.

If any check fails, go to §9.5 immediately.

### 9.5 Rollback (revert env, redeploy, verify)

Aiven's data stayed online and unchanged, so rollback is a configuration change. The
rollback deployment **must skip Prisma migrations** so Aiven's ledger stays 19/18/1;
otherwise `vercel-build.ts` applies `20261023000000_add_neon_extensions` to Aiven and a
retry is blocked by `migrate-to-neon.sh`'s source-ledger guard.

```bash
vercel project pause   # stop writes to Neon
vercel env rm DATABASE_URL production --yes || true
vercel env add DATABASE_URL production   # paste the backed-up Aiven runtime URL
vercel env rm DIRECT_URL production --yes || true
vercel env add DIRECT_URL production     # paste the backed-up Aiven direct URL
vercel env add SKIP_PRISMA_MIGRATE production   # value: 1 (rollback build only)
vercel --prod
vercel env rm SKIP_PRISMA_MIGRATE production --yes
vercel project resume
curl -fsS -o /dev/null -w '%{http_code}\n' https://<production-domain>/api/health
```

- Use the Aiven URLs saved in §9.3; never reconstruct them from memory.
- `SKIP_PRISMA_MIGRATE=1` is a build-time-only rollback switch. Remove it after the
  rollback deploy so the next forward deploy resumes migrations.
- Keep the Neon branch and credentials until the incident review; do not delete
  evidence. Any rows written to Neon after resume are not on Aiven — reconcile
  them explicitly instead of silently discarding them.
- Rollback triggers: health still failing after 5 minutes, >10x error rate,
  row-count mismatch >1%, repeated `P2024`/pool exhaustion, or login failure.
- After rollback, keep every scheduler paused until the Aiven smoke tests pass.
- If Aiven itself is unhealthy, use its PITR layer (see
  `docs/BACKUP-STRATEGY.md` §2) before re-enabling traffic.

### 9.6 Resume schedulers and monitor

Only after §9.4 passes:

- Resume the cron-job.org jobs (dashboard → Enable).
- Re-enable any Vercel Cron / GitHub schedule you found in §9.7.
- Keep the Aiven service (and its PITR) for at least 7 days.
- Keep the Neon branch; run one full backup and verify its manifest checksum.
- Monitor error logs, `P2024`, and connection-pool metrics for 24 hours.

### 9.7 Scheduler pause/resume evidence

| Scheduler | Evidence in repo | Pause | Resume |
|---|---|---|---|
| Vercel Cron | `vercel.json` contains only `buildCommand` / `installCommand`; **no `crons` key**. `docs/CRON-JOBS.md` says the schedules are suggested, not installed | Not Applicable in repo. If dashboard crons exist: Project → Settings → Cron Jobs → disable each | Enable each in the same dashboard |
| GitHub Actions `schedule:` | `.github/workflows/` contains only `notifications.yml`; its triggers are `pull_request`, `push`, `workflow_dispatch` — **no `schedule:`** | Not Applicable. (`gh workflow disable notifications.yml` is unnecessary) | Not Applicable |
| cron-job.org (external, 4 jobs) | `docs/PRODUCTION-LAUNCH.md` §4: `CRON_SECRET` plus image-health, promote-tiers, backup-cleanup, weekly-backup | Dashboard → Cronjobs → select each job → **Disable**. No repository or CLI credentials exist for this account | Dashboard → **Enable** after smoke tests |
| notification-cleanup | `docs/notifications-runbook.md` §3: schedule lives at the host (Vercel Cron or an external scheduler), not in the repo | Pause wherever it was configured | Resume there |
| `ScheduledJob` rows | `prisma/schema.prisma` model drained by `/api/cron/*` (`src/lib/scheduler.ts`); there is no independent timer | No separate pause needed: it is a queue, not a scheduler. With every caller paused it cannot run | No action |

`gh workflow disable notifications.yml` / `gh workflow enable notifications.yml`
are the exact commands **if** a `schedule:` trigger is added later; they are not
required today because no workflow has one.

`docs/CRON-JOBS.md` lists eight endpoints (image-health, promote-tiers,
backup-cleanup, weekly-backup, notification-drain, template-publish,
social-publish, publish-digest), and `src/app/api/cron/reconcile-stats` also
exists. None of them self-schedules; pause **every** external caller, not just
the four named in `docs/PRODUCTION-LAUNCH.md`.

### 9.8 Backup script verification (no real backup)

```bash
bash -n scripts/weekly-backup.sh          # syntax OK
bash scripts/weekly-backup.sh --dry-run   # prints commands; exits 0; no DB/S3 access
```

The script is direct-only and S3/R2-ready; it never falls back to
`DATABASE_URL` or `AIVEN_DATABASE_URL`:

- `scripts/weekly-backup.sh:44` — `DB_URL="${DIRECT_URL:-}"`
- `scripts/weekly-backup.sh:50-53` — rejects any host containing `-pooler`
- `scripts/weekly-backup.sh:97` — `pg_dump ... "$DB_URL"`
- `scripts/weekly-backup.sh:149-164` — requires both `BACKUP_S3_ACCESS_KEY`
  and `BACKUP_S3_SECRET_KEY`, or uses the AWS credential chain when neither is
  set (one without the other fails)
- `scripts/weekly-backup.sh:173-178` — `aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp ...`

S3/R2 variables: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`,
`BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`; optional `BACKUP_S3_KEY` and
`BACKUP_S3_REGION`. Without endpoint + bucket, the dump stays local only.
