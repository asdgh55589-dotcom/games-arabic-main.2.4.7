-- Trigram indexes for fast case-insensitive LIKE/contains on Mod text columns
-- (used by /api/search Prisma fallback). Plain CREATE INDEX (not CONCURRENTLY:
-- Prisma migrate runs in a transaction where CONCURRENTLY is forbidden).
-- Follows prisma/migrations/20260901000000_add_pg_trgm_indexes pattern.

CREATE INDEX IF NOT EXISTS idx_mod_name_trgm
  ON "Mod" USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mod_summary_trgm
  ON "Mod" USING gin (summary gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mod_arabic_title_trgm
  ON "Mod" USING gin ("arabicTitle" gin_trgm_ops);
