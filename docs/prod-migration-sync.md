# Production migration sync runbook — baseline squash (from commit 3fe1c9a)

> DOCS ONLY. Nothing here has been executed against production.
> Run the steps below IN ORDER during a maintenance window. Estimated: 15 min.

## Background

Migration history never contained the core `CREATE TABLE`s (history started
mid-life with `ALTER TABLE "User"`), so `migrate deploy` can never provision
a fresh database and `migrate dev` crashed on the shadow DB. Dev was fixed by
squashing to a single proven baseline (`20260907000000_baseline`, verified:
73/73 tables, zero column diffs vs dev). Production's `_prisma_migrations`
still lists the 22 retired migrations — the next `migrate deploy` would fail
with "applied migrations missing locally". This runbook aligns prod history
with the squashed files. **No table is created, dropped, or altered.**

## 0. Safety FIRST — restore point (Neon)

1. Neon dashboard → project → Branches → **Create branch** from `main`
   (name: `pre-baseline-squash-YYYYMMDD`). This is your instant restore point.
2. Alternatively (or additionally): `pg_dump` the production database and
   store the dump off-site. Do NOT skip this step.

## 1. Inspect current prod history (read-only)

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY migration_name;
```

Expected: the 22 pre-squash rows (`20260720000000_add_tier_system` …
`20260906000000_phase2_upload_providers_quotas`), all with `finished_at`
set and `rolled_back_at` NULL. If any row is missing or rolled back —
STOP and investigate before proceeding.

## 2. Align history metadata (metadata only — zero user-data impact)

```sql
BEGIN;
DELETE FROM "_prisma_migrations"
WHERE migration_name != '20260907000000_baseline';
INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "logs",
   "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid(), '', NOW(), '20260907000000_baseline', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260907000000_baseline'
);
COMMIT;
```

Verify exactly one row remains:

```sql
SELECT migration_name FROM "_prisma_migrations";
-- expected: 20260907000000_baseline
```

## 3. Additive extras with IF NOT EXISTS guards (safe to re-run)

Dev was found missing the 6 trigram perf indexes (created there during the
squash). Apply the same to prod — all statements are idempotent:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_user_username_trgm
  ON "User" USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_email_trgm
  ON "User" USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_display_name_trgm
  ON "User" USING gin ("displayName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mod_name_trgm
  ON "Mod" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mod_summary_trgm
  ON "Mod" USING gin (summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mod_arabic_title_trgm
  ON "Mod" USING gin ("arabicTitle" gin_trgm_ops);
```

## 4. Verification queries (table/column/index parity vs schema)

```sql
-- 73 user tables expected (excludes _prisma_migrations itself)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name != '_prisma_migrations';
-- expected: 73

-- Phase 2 tables present
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('UploadAsset','QuotaPolicy','QuotaOverride',
                     'UploadUsageDaily','CreatorStorage');
-- expected: 5 rows

-- ModFileLink provider columns present
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ModFileLink'
  AND column_name IN ('provider','storageKey','wrappedUrl','bytes',
                      'mime','checksum','uploadedBy');
-- expected: 7 rows

-- Trigram indexes present
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%_trgm'
ORDER BY 1;
-- expected: 6 rows (see step 3 list)
```

Then, from a checkout of this branch with production env:

```bash
npx prisma migrate status
# expected: "Database schema is up to date!"
```

## 5. Deploy order afterwards

1. Run steps 0–4.
2. Deploy the app (build runs `prisma migrate deploy` — no-op when in sync).
3. Re-run the step-4 queries post-deploy as a smoke check.

## 6. Rollback plan

- **History-only problem** (wrong row deleted, typo in baseline name):
  re-insert the deleted rows from the Neon branch created in step 0
  (compare `_prisma_migrations`), or restore that branch as primary.
  No user data is ever at risk from step 2 alone.
- **Anything else looks wrong**: promote the step-0 Neon branch
  (`pre-baseline-squash-YYYYMMDD`) to primary and re-point the app —
  full database restore, minutes of downtime at most.
- The retired migration files remain recoverable in git history
  (commit `3fe1c9a^` and earlier) if per-change archaeology is ever needed.

## 7. Known residual (not a blocker)

`prisma migrate dev` prompts to name a migration even with zero schema
changes, because the 6 raw-SQL trigram indexes are not modelable in
`schema.prisma`. Rule: never accept `DROP INDEX` for `idx_*_trgm` —
inspect the generated SQL first. (Pre-existing repo behavior since the
trgm migrations landed; the squash only made it visible by fixing the
shadow-DB crash.)
