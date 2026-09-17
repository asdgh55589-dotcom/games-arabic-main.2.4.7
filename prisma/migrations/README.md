# Migrations runbook note

WARNING: Every time prisma migrate dev is run, it will propose
dropping pg_trgm GIN indexes because Prisma cannot model them.
NEVER allow these drops. Remove the DROP lines from the generated
migration before applying. Affected: 6 GIN indexes on search fields.

## Why this happens

The committed baseline migration (`20260907000000_baseline`, extended by
commit `415f698`) creates six trigram indexes for search performance:

- `idx_user_username_trgm`, `idx_user_email_trgm`, `idx_user_display_name_trgm`
- `idx_mod_name_trgm`, `idx_mod_summary_trgm`, `idx_mod_arabic_title_trgm`

GIN-with-trgm-ops indexes cannot be expressed in `schema.prisma`, so the
Prisma differ always flags them as drift and emits `DROP INDEX` lines in
every newly generated migration. Those lines must be deleted by hand
before applying — the indexes exist in production and must stay.

## Checklist for every new migration

1. Run `prisma migrate dev --create-only --name <change>` (never bare `dev` first).
2. Open the generated `migration.sql`.
3. Delete any `DROP INDEX ..._trgm` lines (keep everything else).
4. Verify the remainder is additive-only (CREATE TABLE / CREATE INDEX / ADD CONSTRAINT).
5. Apply with `prisma migrate deploy`.
6. Confirm with `prisma migrate status` and a row count on `_prisma_migrations`.

## History

- The baseline checksum itself once drifted for the same reason (baseline
  edited post-apply in `415f698`); reconciled via bookkeeping-only
  `_prisma_migrations.checksum` update after verifying the objects exist.
  Never run `prisma migrate reset` on a shared database to fix drift.
