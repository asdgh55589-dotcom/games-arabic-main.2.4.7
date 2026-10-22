-- ============================================================================
-- 20261021000000_stats_baseline_and_dedup
--
-- Repair of the statistics system:
--   (1) LEGACY ENDORSEMENT VOCABULARY — 'up'/'down' → 'thumbsup'/'thumbsdown'.
--       MUST run BEFORE the baseline backfill, because the backfill counts
--       only positive values and 'up' would otherwise be counted as "not an
--       endorsement" (9 of the 10 live rows carry the legacy value 'up').
--   (2) BASELINE columns  — split every displayed counter into
--       "seeded/fabricated portion" (baseline) + "real portion" (detail rows).
--       Invariant enforced from now on:
--         Mod.views        == Mod.viewsBaseline        + COUNT(ModView   WHERE modId)
--         Mod.downloads    == Mod.downloadsBaseline    + COUNT(DownloadClick WHERE modId)
--         Mod.endorsements == Mod.endorsementsBaseline + COUNT(Endorsement WHERE modId
--                                                              AND value IN ('fire','sparkle','thumbsup'))
--         Game.totalDownloads    == SUM(Mod.downloads)    OVER PUBLISHED mods
--         Game.totalEndorsements == SUM(Mod.endorsements) OVER PUBLISHED mods
--         Game.modCount          == COUNT(Mod)            OVER PUBLISHED mods
--   (3) DURABLE DEDUP — dayBucket + 4 unique indexes (one-count-per-mod-per-day).
--   (4) seriesId BACKFILL — guarded, matches only unambiguous legacy names.
--
-- BASELINE SEMANTICS (important):
--   baseline := counter - COUNT(real detail rows)
--   i.e. the baseline is ONLY the fabricated/seeded portion. The counter that
--   the site already displays ALREADY includes the real detail rows (they were
--   counted when the rows were written), so:
--     counter BEFORE == baseline AFTER + COUNT(rows)   → the displayed numbers
--     do NOT move, and `counter - baseline` is immediately the real count.
--   If the baseline were set to the raw counter instead, the reconciliation
--   job would ADD every detail row a second time (+6,223 views / +2 downloads
--   / +10 endorsements site-wide on the current dataset).
--
-- IDEMPOTENCY: every statement is written to be safe to re-run
-- (ADD COLUMN IF NOT EXISTS / UPDATE ... WHERE <baseline> = 0 / CREATE INDEX
-- IF NOT EXISTS). The backfill is idempotent because it always computes an
-- ABSOLUTE value (counter - rows), never an increment.
--
-- ROLLBACK: see the commented-out inverse block at the bottom of this file.
-- ============================================================================

-- ============================================================================
-- (1) LEGACY ENDORSEMENT VOCABULARY (R3)
--     The live endorse route only ever writes 'fire' | 'sparkle' | 'thumbsup' |
--     'thumbsdown', but 9 of the 10 existing rows still carry the pre-4-tier
--     value 'up'. The route's else-fallback mis-bucketed those legacy rows
--     into reactionThumbsDown, which produced a live -1 on those mods.
--     Normalising 'up' → 'thumbsup' makes those 9 rows count as endorsements,
--     which is what they were meant to be from the start.
--     'thumbsdown' is a NEGATIVE reaction and is NOT counted as an endorsement
--     by the reconciliation SQL.
-- ============================================================================

UPDATE "Endorsement" SET "value" = 'thumbsup'  WHERE "value" = 'up';
UPDATE "Endorsement" SET "value" = 'thumbsdown' WHERE "value" = 'down';

-- ============================================================================
-- (2) BASELINE COLUMNS
--     The backfill sets baseline = counter - (number of real detail rows), so
--     the numbers that are displayed on the site DO NOT CHANGE (the site must
--     not look dead) while the real portion becomes immediately auditable:
--         real = counter - baseline == COUNT(detail rows)
--     Before the backfill ~99.7%–99.9998% of every displayed number was
--     fabricated by scripts/seed.ts. Measured on production (read-only,
--     2026-10-22): 225 mods, SUM(views)=3,702,523 vs 6,223 real ModView rows;
--     SUM(downloads)=1,032,752 vs 2 DownloadClick rows; SUM(endorsements)
--     =143,353 vs 10 Endorsement rows.
-- ============================================================================

ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "downloadsBaseline" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "endorsementsBaseline" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mod" ADD COLUMN IF NOT EXISTS "viewsBaseline" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "totalDownloadsBaseline" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "totalEndorsementsBaseline" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Series" ADD COLUMN IF NOT EXISTS "totalDownloadsBaseline" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Series" ADD COLUMN IF NOT EXISTS "totalEndorsementsBaseline" INTEGER NOT NULL DEFAULT 0;

-- Backfill: baseline := counter - COUNT(real detail rows).
--
-- Idempotency: the guard `WHERE <baseline> = 0` makes the statement a
-- FILL-ONCE operation, and because it computes an ABSOLUTE value (never an
-- increment) a re-run produces the same result. GREATEST(0, ...) protects
-- against a counter that is smaller than its row count (never observed, but
-- it would otherwise produce a negative baseline).
--
-- A correlated sub-count is used (NOT a JOIN against an aggregate) because
-- every mod must be updated — a JOIN would silently skip the 224 mods that
-- have no DownloadClick row and leave their baseline at 0, which would make
-- the reconciliation reset their counter to zero.
--
-- The guard is "fill once" (baseline IS NULL/0 -> compute it) and the formula
-- is absolute (counter - rows), so re-running the migration is a no-op.
UPDATE "Mod" m
SET "downloadsBaseline" = GREATEST(0, m."downloads" - (
      SELECT COUNT(*)::int FROM "DownloadClick" d WHERE d."modId" = m."id"
    ))
WHERE m."downloadsBaseline" = 0;

UPDATE "Mod" m
SET "endorsementsBaseline" = GREATEST(0, m."endorsements" - (
      SELECT COUNT(*)::int FROM "Endorsement" e
       WHERE e."modId" = m."id" AND e."value" IN ('fire', 'sparkle', 'thumbsup')
    ))
WHERE m."endorsementsBaseline" = 0;

UPDATE "Mod" m
SET "viewsBaseline" = GREATEST(0, m."views" - (
      SELECT COUNT(*)::int FROM "ModView" v WHERE v."modId" = m."id"
    ))
WHERE m."viewsBaseline" = 0;

-- Game baselines are the SUM of the baselines of the game's PUBLISHED mods
-- (same scope as Game.totalDownloads / syncGameCounts). No counter condition
-- is used here on purpose: the baseline is defined by the mods, not by the
-- (possibly drifted) stored game counter.
UPDATE "Game" g
SET "totalDownloadsBaseline" = (
      SELECT COALESCE(SUM(m."downloadsBaseline"), 0)::int FROM "Mod" m
       WHERE m."gameId" = g."id" AND m."workflowStatus" = 'PUBLISHED'
    )
WHERE g."totalDownloadsBaseline" = 0;

UPDATE "Game" g
SET "totalEndorsementsBaseline" = (
      SELECT COALESCE(SUM(m."endorsementsBaseline"), 0)::int FROM "Mod" m
       WHERE m."gameId" = g."id" AND m."workflowStatus" = 'PUBLISHED'
    )
WHERE g."totalEndorsementsBaseline" = 0;

-- Series baselines are the SUM of the baselines of the series' mods (same
-- scope as Series.totalDownloads / syncSeriesCounts).
UPDATE "Series" s
SET "totalDownloadsBaseline" = (
      SELECT COALESCE(SUM(m."downloadsBaseline"), 0)::int FROM "Mod" m
       WHERE m."seriesId" = s."id"
    )
WHERE s."totalDownloadsBaseline" = 0;

UPDATE "Series" s
SET "totalEndorsementsBaseline" = (
      SELECT COALESCE(SUM(m."endorsementsBaseline"), 0)::int FROM "Mod" m
       WHERE m."seriesId" = s."id"
    )
WHERE s."totalEndorsementsBaseline" = 0;

-- ============================================================================
-- (3) DURABLE DEDUP — dayBucket + unique indexes (C-SCHEMA-2)
--     dayBucket = UTC midnight of the event day, so a guest is counted at most
--     once per mod per day (durable backstop behind the Redis hourly dedup).
--
--     ipAddress now stores a HASHED guest identifier (hashIdentity), never a
--     raw IP address. Historical rows still hold raw IPv4 values (5,963 of
--     6,182 rows) — they are left untouched, but they are also the reason the
--     dayBucket of historical rows must stay NULL (see below).
--
--     Postgres treats NULLs as DISTINCT in unique indexes, therefore:
--       * authenticated users (userId set, ipAddress NULL) are guarded by
--         (modId, userId, dayBucket);
--       * guests (userId NULL, ipAddress set) are guarded by
--         (modId, ipAddress, dayBucket).
--     Both indexes are required.
--
--     Existing rows keep dayBucket = NULL. NULLs never collide in a unique
--     index, so no existing row is rejected and no real history is destroyed.
--     This is deliberate: back-filling dayBucket from viewedAt would create
--     7 colliding (modId, userId) rows and 126 colliding (modId, ipAddress)
--     rows, i.e. it would DELETE real viewing history. The defensive DELETEs
--     below are the safety net for that scenario (they keep the OLDEST row of
--     every duplicate group) — today they match 0 rows because every
--     historical row has dayBucket = NULL.
-- ============================================================================

ALTER TABLE "ModView" ADD COLUMN IF NOT EXISTS "dayBucket" TIMESTAMP(3);
ALTER TABLE "DownloadClick" ADD COLUMN IF NOT EXISTS "dayBucket" TIMESTAMP(3);

-- Defensive dedup (guest rows) — keep the OLDEST row of each duplicate group.
DELETE FROM "ModView" a USING "ModView" b
WHERE a."id" > b."id"
  AND a."modId" = b."modId"
  AND a."ipAddress" IS NOT NULL
  AND a."ipAddress" = b."ipAddress"
  AND a."dayBucket" IS NOT NULL
  AND b."dayBucket" IS NOT NULL
  AND a."dayBucket" = b."dayBucket";

DELETE FROM "DownloadClick" a USING "DownloadClick" b
WHERE a."id" > b."id"
  AND a."modId" = b."modId"
  AND a."ipAddress" IS NOT NULL
  AND a."ipAddress" = b."ipAddress"
  AND a."dayBucket" IS NOT NULL
  AND b."dayBucket" IS NOT NULL
  AND a."dayBucket" = b."dayBucket";

-- Defensive dedup (authenticated rows) — same guard for the userId index.
DELETE FROM "ModView" a USING "ModView" b
WHERE a."id" > b."id"
  AND a."modId" = b."modId"
  AND a."userId" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."dayBucket" IS NOT NULL
  AND b."dayBucket" IS NOT NULL
  AND a."dayBucket" = b."dayBucket";

DELETE FROM "DownloadClick" a USING "DownloadClick" b
WHERE a."id" > b."id"
  AND a."modId" = b."modId"
  AND a."userId" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."dayBucket" IS NOT NULL
  AND b."dayBucket" IS NOT NULL
  AND a."dayBucket" = b."dayBucket";

-- Index names match Prisma's default naming convention so a future
-- `prisma migrate diff` produces NO drift.
CREATE UNIQUE INDEX IF NOT EXISTS "ModView_modId_userId_dayBucket_key" ON "ModView"("modId", "userId", "dayBucket");
CREATE UNIQUE INDEX IF NOT EXISTS "ModView_modId_ipAddress_dayBucket_key" ON "ModView"("modId", "ipAddress", "dayBucket");
CREATE UNIQUE INDEX IF NOT EXISTS "DownloadClick_modId_userId_dayBucket_key" ON "DownloadClick"("modId", "userId", "dayBucket");
CREATE UNIQUE INDEX IF NOT EXISTS "DownloadClick_modId_ipAddress_dayBucket_key" ON "DownloadClick"("modId", "ipAddress", "dayBucket");

-- ============================================================================
-- (4) seriesId BACKFILL (R6)
--     scripts/seed.ts only wrote the LEGACY string column ("Mod"."series") and
--     never the FK ("Mod"."seriesId"), so /api/series/mods (which filters on
--     seriesId) listed 0 mods for every series.
--
--     The statement below links a mod to a series ONLY when the legacy string
--     matches exactly one series name (trimmed + case-insensitive). Ambiguous
--     names are skipped on purpose — a wrong link is worse than no link.
--
--     MEASURED ON PRODUCTION (read-only, 2026-10-22): 0 of 225 mods would
--     match. Every seeded mod has "series" = '' (empty string) — there are 5
--     Series rows ("Final Fantasy", "God of War", "The Elder Scrolls", "The
--     Legend of Zelda", "The Witcher") and 225 mods, of which 0 carry a legacy
--     series name and 0 carry a seriesId. The statement is therefore a
--     documented no-op on the current dataset and only becomes effective for
--     rows that carry a real legacy series name.
--
--     A slug-based variant was also measured (Series.slug = slugify(Mod.series)):
--     0 matches as well — there is simply no legacy data to migrate.
-- ============================================================================

UPDATE "Mod" m SET "seriesId" = s."id"
FROM "Series" s
WHERE m."seriesId" IS NULL
  AND btrim(m."series") <> ''
  AND lower(btrim(s."name")) = lower(btrim(m."series"))
  AND (
    SELECT COUNT(*) FROM "Series" s2
    WHERE lower(btrim(s2."name")) = lower(btrim(m."series"))
  ) = 1;

-- ============================================================================
-- ROLLBACK (inverse of this migration) — run manually, in reverse order.
-- NOTE: the baseline columns are PURELY ADDITIVE — dropping them leaves the
-- counters (views/downloads/endorsements/…) exactly as they are, so the
-- rollback never changes a number that the site displays. The only
-- non-reversible part is the endorsement vocabulary normalisation.
-- ============================================================================
-- -- (4) undo the seriesId backfill (only rows that this migration linked)
-- UPDATE "Mod" m SET "seriesId" = NULL
-- FROM "Series" s
-- WHERE m."seriesId" = s."id" AND btrim(m."series") <> '';
--
-- -- (3) drop the unique indexes and the dayBucket columns
-- DROP INDEX IF EXISTS "DownloadClick_modId_ipAddress_dayBucket_key";
-- DROP INDEX IF EXISTS "DownloadClick_modId_userId_dayBucket_key";
-- DROP INDEX IF EXISTS "ModView_modId_ipAddress_dayBucket_key";
-- DROP INDEX IF EXISTS "ModView_modId_userId_dayBucket_key";
-- ALTER TABLE "DownloadClick" DROP COLUMN IF EXISTS "dayBucket";
-- ALTER TABLE "ModView" DROP COLUMN IF EXISTS "dayBucket";
--
-- -- (1) legacy values cannot be restored 1:1 (the original value is lost).
-- --    Only reversible if you know which rows were migrated:
-- -- UPDATE "Endorsement" SET "value" = 'up' WHERE "value" = 'thumbsup' AND "createdAt" < <migration timestamp>;
--
-- -- (2) drop the baseline columns (the counters keep their current values)
-- ALTER TABLE "Series" DROP COLUMN IF EXISTS "totalEndorsementsBaseline";
-- ALTER TABLE "Series" DROP COLUMN IF EXISTS "totalDownloadsBaseline";
-- ALTER TABLE "Game" DROP COLUMN IF EXISTS "totalEndorsementsBaseline";
-- ALTER TABLE "Game" DROP COLUMN IF EXISTS "totalDownloadsBaseline";
-- ALTER TABLE "Mod" DROP COLUMN IF EXISTS "viewsBaseline";
-- ALTER TABLE "Mod" DROP COLUMN IF EXISTS "endorsementsBaseline";
-- ALTER TABLE "Mod" DROP COLUMN IF EXISTS "downloadsBaseline";
