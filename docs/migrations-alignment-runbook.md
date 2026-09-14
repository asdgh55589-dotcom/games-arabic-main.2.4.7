# SA-2 Migrations Alignment Runbook (Foundation Freeze)

> **DOCS-ONLY. DO NOT EXECUTE AGAINST PRODUCTION WITHOUT OWNER.**
>
> Nothing in this file has been executed against production Neon.
> Run ONLY during a maintenance window with owner approval.
> Estimated: 15 min + verification.

## Context

- Production Neon `_prisma_migrations` still lists the 22 pre-squash rows
  (see `docs/prod-migration-sync.md:108-111` — "Production's
  `_prisma_migrations` still lists the 22 retired migrations").
- Foundation-freeze branch (`feat/foundation-freeze`) squashes to
  `20260907000000_baseline` + additive migrations.
- This runbook aligns prod history metadata to the 8 canonical names below.
  **No table is created, dropped, or altered by Step 2–3** (metadata only).
- Note on the 9th migration: this checkout contains
  `20260907110000_add_ia_multipart_journal` (added same-branch after the
  brief — see `docs/prod-migration-sync.md:16-19`). The brief listed 7
  additive + baseline = 8 total. The 9th is intentionally EXCLUDED from the
  NOT IN list below; it will apply normally via `prisma migrate deploy`
  after alignment (tables 75 → 76). Hence Step 5 expects `75+`.

Canonical 8 (verbatim directory names under `prisma/migrations/`):

1. `20260907000000_baseline`
2. `20260907000001_wave3a_likes_composite_indexes`
3. `20260907000002_wave3a_news_author`
4. `20260907000003_wave3b_comment_clicks`
5. `20260907070000_add_creator_track_and_portfolio`
6. `20260907080000_add_creator_approve_note`
7. `20260907090000_add_onboarding_completed`
8. `20260907100000_add_password_reset_tokens`

## Step 0 — Neon restore point (UI path)

1. Neon dashboard → project → Branches → **Create branch** from `main`
   (name: `pre-sa2-alignment-YYYYMMDD`). Instant restore point — do NOT skip.
   (Same rule as `docs/prod-migration-sync.md:113-118` §0.)
2. Optionally (recommended for releases that add tables): `pg_dump` the
   production database and store the dump off-site.

Rollback: promote the Step-0 Neon branch to primary (minutes of downtime
at most). For history-only mistakes (wrong row deleted, typo), re-insert
deleted rows by comparing `_prisma_migrations` against the Step-0 branch.

## Step 1 — Connect via psql (read-only first)

```bash
# From a shell with production DATABASE_URL exported (never commit the URL):
psql "$DATABASE_URL" -c 'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name;'
# expected pre-alignment: the 22 pre-squash rows
# (20260720000000_add_tier_system … 20260906000000_phase2_upload_providers_quotas),
# all finished_at set, rolled_back_at NULL. Anything else — STOP.
```

Do NOT proceed until Step 0 restore point is confirmed.

## Step 2 — Align history metadata (metadata only, zero user-data impact)

```sql
BEGIN;
DELETE FROM "_prisma_migrations"
WHERE migration_name NOT IN (
  '20260907000000_baseline',
  '20260907000001_wave3a_likes_composite_indexes',
  '20260907000002_wave3a_news_author',
  '20260907000003_wave3b_comment_clicks',
  '20260907070000_add_creator_track_and_portfolio',
  '20260907080000_add_creator_approve_note',
  '20260907090000_add_onboarding_completed',
  '20260907100000_add_password_reset_tokens'
);
COMMIT;
```

Verify exactly 8 rows remain:

```sql
SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name;
-- expected: the 8 names above, in order
```

## Step 3 — Mark applied via Prisma (per migration, with DATABASE_URL)

Run from a checkout of this branch (`feat/foundation-freeze`) with
production `DATABASE_URL` exported. One command per migration, in order:

```bash
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907000000_baseline"
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907000001_wave3a_likes_composite_indexes"
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907000002_wave3a_news_author"
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907000003_wave3b_comment_clicks"
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907070000_add_creator_track_and_portfolio"
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907080000_add_creator_approve_note"
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907090000_add_onboarding_completed"
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260907100000_add_password_reset_tokens"
```

If any `resolve` reports "already applied" — that is fine (idempotent).
If it reports a checksum mismatch or missing migration dir — STOP, restore
from Step 0, investigate. Do NOT run `migrate dev` against production.

## Step 4 — pg_trgm extension + 6 GIN indexes (idempotent, safe to re-run)

Index definitions derived verbatim from `docs/prod-migration-sync.md`
trgm section (Step 3 extras). Source quoted per index; all statements use
`IF NOT EXISTS` so existing DBs are safe. Fresh DBs get the same block via
the appended tail of `prisma/migrations/20260907000000_baseline/migration.sql`.

```sql
-- source: docs/prod-migration-sync.md:162
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- source: docs/prod-migration-sync.md:164-165
CREATE INDEX IF NOT EXISTS idx_user_username_trgm
  ON "User" USING gin (username gin_trgm_ops);
-- source: docs/prod-migration-sync.md:166-167
CREATE INDEX IF NOT EXISTS idx_user_email_trgm
  ON "User" USING gin (email gin_trgm_ops);
-- source: docs/prod-migration-sync.md:168-169
CREATE INDEX IF NOT EXISTS idx_user_display_name_trgm
  ON "User" USING gin ("displayName" gin_trgm_ops);
-- source: docs/prod-migration-sync.md:170-171
CREATE INDEX IF NOT EXISTS idx_mod_name_trgm
  ON "Mod" USING gin (name gin_trgm_ops);
-- source: docs/prod-migration-sync.md:172-173
CREATE INDEX IF NOT EXISTS idx_mod_summary_trgm
  ON "Mod" USING gin (summary gin_trgm_ops);
-- source: docs/prod-migration-sync.md:174-175
CREATE INDEX IF NOT EXISTS idx_mod_arabic_title_trgm
  ON "Mod" USING gin ("arabicTitle" gin_trgm_ops);
```

Notes (from `docs/prod-migration-sync.md:235-254`):

- Trigram indexes are intentionally schema-invisible (`gin_trgm_ops`
  cannot be modeled in `schema.prisma`). `migrate diff` history-vs-schema
  stays empty.
- NEVER accept auto-generated `DROP INDEX idx_*_trgm` lines in a new
  migration (Prisma P3006 trap) — delete those lines before applying.
- Dev DB intentionally carries NO trgm indexes (keeps `migrate dev`
  drift-free); staging/prod get them via this step.

## Step 5 — Verification queries (four, with expected values)

```sql
-- Q1. History: exactly 8 rows
SELECT count(*) FROM "_prisma_migrations";
-- expected: 8

-- Q2. Tables: 75+ (73 baseline + CommentSectionClick + PasswordResetToken = 75;
-- 76 if 20260907110000_add_ia_multipart_journal already deployed)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name != '_prisma_migrations';
-- expected: 75+ (75 pre-IA-journal, 76 post-IA-journal)

-- Q3. pg_trgm extension present
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
-- expected: 1 row (pg_trgm)

-- Q4. Six trigram indexes present
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%_trgm'
ORDER BY 1;
-- expected: 6 rows (idx_user_username_trgm, idx_user_email_trgm,
-- idx_user_display_name_trgm, idx_mod_name_trgm, idx_mod_summary_trgm,
-- idx_mod_arabic_title_trgm)
```

If ANY value differs — STOP, do not deploy; restore from Step 0 if needed
and investigate.

## Step 6 — Prisma status is up-to-date

```bash
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
# expected: "Database schema is up to date!"
```

Deploy order afterwards:

1. Steps 0–6 above (this runbook).
2. Deploy the app (build runs `prisma migrate deploy` — applies only
   `20260907110000_add_ia_multipart_journal` if not yet applied; otherwise
   no-op).
3. Re-run Step-5 queries post-deploy as a smoke check (tables 75 → 76).

---

*DOCS-ONLY reminder: DO NOT EXECUTE AGAINST PRODUCTION WITHOUT OWNER.*
