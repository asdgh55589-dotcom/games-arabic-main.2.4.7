# Production migration sync runbook — baseline squash (historical)

> **Historical record.** This runbook documents the one-time baseline squash
> alignment that was applied to the production Neon database. Do not re-run it
> against a live database. For current operations see `docs/NEON-SETUP.md`; for
> migration rules see `prisma/migrations/README.md`.

## Current state

- Neon PostgreSQL 17 is the live primary.
- The production ledger starts at `20260920000000_baseline_squash` and then
  applies the additive migrations under `prisma/migrations/`.
- Production schema: **98 public base tables** (excluding
  `_prisma_migrations`), **0 GIN indexes**, extensions `pg_trgm` + `pgcrypto`.
- Pooling: `connection_limit=5`, `pool_timeout=15`, `connect_timeout=15`,
  `socket_timeout=30`.

## What the baseline squash changed

Migration history never contained the core `CREATE TABLE`s (history started
mid-life with `ALTER TABLE "User"`), so `migrate deploy` could not provision a
fresh database and `migrate dev` crashed on the shadow DB. Dev was fixed by
squashing to a single proven baseline (`20260920000000_baseline_squash`,
verified 73/73 tables at the time, zero column diffs vs dev). Production's
`_prisma_migrations` still listed the 22 retired migrations — the next
`migrate deploy` would fail with "applied migrations missing locally". The
alignment reconciled history metadata; **no table was created, dropped, or
altered by the metadata step.**

## Restore point (historical procedure)

1. Neon Console → project → Branches → **Create branch** from `production`
   (name: `pre-baseline-squash-YYYYMMDD`). Instant restore point.
2. Alternatively (or additionally): `pg_dump` the production database and
   store the dump off-site.

Rollback: promote the restore branch to primary (minutes of downtime at most).
For history-only mistakes (wrong row deleted, typo), re-insert deleted rows by
comparing `_prisma_migrations` against the restore branch.

## Ledger alignment (historical procedure)

The operation was metadata-only:

```sql
BEGIN;
DELETE FROM "_prisma_migrations"
WHERE migration_name != '20260920000000_baseline_squash';
INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs",
   "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid(), '', NOW(), '20260920000000_baseline_squash', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260920000000_baseline_squash'
);
COMMIT;
```

Then the additive migrations were applied with `prisma migrate deploy`. The
duplicate `20261008000000_team_owner_unique` entry remains rolled back.

## Verification (current expectations)

```sql
-- History: no failed rows; duplicate team_owner_unique stays rolled back
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY migration_name;

-- Tables: 98 public base tables (excluding _prisma_migrations)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name <> '_prisma_migrations';

-- GIN indexes: 0 rows
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexdef ILIKE '%USING gin%'
ORDER BY 1;

-- Extensions: pg_trgm + pgcrypto
SELECT extname FROM pg_extension
WHERE extname IN ('pg_trgm', 'pgcrypto')
ORDER BY 1;
```

Then:

```bash
npx prisma migrate status
# expected: "Database schema is up to date!"
```

## Historical addenda

- **Trigram indexes are intentionally schema-invisible.** `gin_trgm_ops`
  indexes cannot be modeled in `schema.prisma`. Production has **0 GIN
  indexes**; `20261023000000_add_neon_extensions` creates only the
  `pg_trgm` + `pgcrypto` extensions.
- **Never add `DROP INDEX idx_*_trgm` to a migration.** `migrate dev`
  auto-generates those DROPs whenever a dev database carries raw-SQL indexes;
  accepting them once deleted production-grade search indexes AND hard-blocked
  later `migrate dev` runs (Prisma state validation P3006).
- **Post-baseline migrations must sort after `20260920000000_baseline_squash`.**
  Always verify with `migrate diff … --script` (expect:
  `-- This is an empty migration.`) before committing a migration.
- The retired migration files remain recoverable in git history
  (commit `3fe1c9a^` and earlier) if per-change archaeology is needed.
