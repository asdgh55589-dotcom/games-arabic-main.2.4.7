# Migrations runbook note

## Current state (audited 2026-10-23)

The live Neon database has **98 public base tables**, **0 GIN indexes**, and
the extensions `pg_trgm` + `pgcrypto`. Historical runbooks
(`docs/prod-migration-sync.md`, `docs/migrations-alignment-runbook.md`) describe
six `*_trgm` GIN indexes from a prior plan; those indexes are **not** present in
production. Do not add them unless you first confirm they exist:

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexdef ILIKE '%USING gin%'
ORDER BY 1;
```

`20261023000000_add_neon_extensions` only creates `pg_trgm` and `pgcrypto`; it
intentionally creates no GIN indexes.

## Guardrails for every new migration

1. Run `prisma migrate dev --create-only --name <change>` (never bare `dev` first).
2. Open the generated `migration.sql`.
3. Compare against the live source before accepting any `DROP INDEX`; Prisma
   cannot model GIN/trigram indexes and may propose dropping indexes that do
   exist in a different environment.
4. Keep the remainder additive-only (CREATE TABLE / CREATE INDEX / ADD CONSTRAINT).
5. Apply with `prisma migrate deploy` against `DIRECT_URL`.
6. Confirm with `prisma migrate status` and a row count on `_prisma_migrations`.

## Idempotent historical migrations

`20260921000000_staff_page_access` is already present in the baseline squash and
in the live ledger. Its SQL was made idempotent (`IF NOT EXISTS` / guarded FK)
so a fresh `prisma migrate deploy` succeeds without changing the applied
checksum on an existing database.

## History

- The baseline checksum once drifted because baseline SQL was edited
  post-apply (`415f698`); it was reconciled via a bookkeeping-only
  `_prisma_migrations.checksum` update after verifying the objects existed.
  Never run `prisma migrate reset` on a shared database to fix drift.
