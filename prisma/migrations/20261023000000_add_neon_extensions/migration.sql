-- ============================================================================
-- 20261023000000_add_neon_extensions
--
-- Ensure extension parity with the previous Aiven database:
--   pg_trgm  — trigram matching used by Prisma `contains`/search queries
--   pgcrypto — cryptographic helpers (e.g. gen_random_uuid) used by defaults
--
-- Both statements are idempotent (IF NOT EXISTS), so this migration is safe to
-- run against a database where the extensions were already provisioned.
-- No GIN indexes are created: the live Aiven database has none, and creating
-- them here would change query plans beyond the migration's scope.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
