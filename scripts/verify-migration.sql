-- verify-migration.sql — read-only post-restore verification for Aiven -> Neon
--
-- Usage:
--   psql -X "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/verify-migration.sql
--
-- This file is SELECT-only and safe to run against a read-only replica.
-- It aborts with exit code 3 if any expected value does not match. It checks
-- the 10 key tables and invariants; full 98-table/object parity is enforced by
-- the manifests in scripts/migrate-to-neon.sh before this file runs.
--
-- Expected snapshot (2026-10-22):
--   98 public base tables, 0 GIN indexes
--   _prisma_migrations: 19 rows / 18 applied / 1 rolled back BEFORE
--     `--check-prisma`; after `20261023000000_add_neon_extensions` is applied
--     the expected state is 20 rows / 19 applied / 1 rolled back.
--   20261008000000_team_owner_unique: 2 rows / 1 rolled back
--   _prisma_migrations_backup_20260920: 18 rows
--   User=12 Mod=225 Game=32 Series=5 Team=4 ModView=6223
--   DownloadClick=2 Endorsement=10 ModComment=902 AuditLog=151
--   ModView.dayBucket NULL=6223/6223, DownloadClick.dayBucket NULL=2/2

\set ON_ERROR_STOP on
\pset pager off
\pset null '(null)'

\echo ''
\echo '=== 1. Public base tables ==='
SELECT count(*) AS public_base_tables,
       98 AS expected,
       CASE WHEN count(*) = 98 THEN 'PASS' ELSE 'FAIL' END AS result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

\echo ''
\echo '=== 2. Required extensions ==='
WITH required(extname) AS (
  VALUES ('pg_trgm'), ('pgcrypto')
)
SELECT r.extname,
       COALESCE(e.extversion, '(missing)') AS version,
       CASE WHEN e.extname IS NULL THEN 'FAIL' ELSE 'PASS' END AS result
FROM required r
LEFT JOIN pg_extension e ON e.extname = r.extname
ORDER BY r.extname;

\echo ''
\echo '=== 3. Prisma migration ledger ==='
WITH ledger AS (
  SELECT count(*)::int AS total,
         count(*) FILTER (
           WHERE "finished_at" IS NOT NULL
             AND "rolled_back_at" IS NULL
         )::int AS applied,
         count(*) FILTER (
           WHERE "rolled_back_at" IS NOT NULL
         )::int AS rolled_back,
         count(*) FILTER (
           WHERE "finished_at" IS NULL
             AND "rolled_back_at" IS NULL
         )::int AS unfinished
  FROM public."_prisma_migrations"
)
SELECT check_name, expected, actual, result
FROM (
  SELECT 1 AS ord,
         'ledger shape (19/18/1 pre-Prisma or 20/19/1 post-Prisma)' AS check_name,
         '19/18/1 or 20/19/1' AS expected,
         format('%s/%s/%s', total, applied, rolled_back) AS actual,
         CASE WHEN ((total = 19 AND applied = 18) OR (total = 20 AND applied = 19))
                   AND rolled_back = 1
                   AND unfinished = 0
              THEN 'PASS' ELSE 'FAIL' END AS result
  FROM ledger

  UNION ALL

  SELECT 2,
         '20261008000000_team_owner_unique rows',
         '2',
         count(*)::text,
         CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
  FROM public."_prisma_migrations"
  WHERE "migration_name" = '20261008000000_team_owner_unique'

  UNION ALL

  SELECT 3,
         '20261008000000_team_owner_unique rolled back',
         '1',
         count(*)::text,
         CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END
  FROM public."_prisma_migrations"
  WHERE "migration_name" = '20261008000000_team_owner_unique'
    AND "rolled_back_at" IS NOT NULL

  UNION ALL

  SELECT 4,
         '_prisma_migrations_backup_20260920 rows',
         '18',
         count(*)::text,
         CASE WHEN count(*) = 18 THEN 'PASS' ELSE 'FAIL' END
  FROM public."_prisma_migrations_backup_20260920"

  UNION ALL

  SELECT 5,
         '20261023000000_add_neon_extensions state',
         'absent for 19 / applied for 20',
         CASE WHEN EXISTS (
                SELECT 1
                FROM public."_prisma_migrations"
                WHERE "migration_name" = '20261023000000_add_neon_extensions'
                  AND "finished_at" IS NOT NULL
                  AND "rolled_back_at" IS NULL
              ) THEN 'applied' ELSE 'absent' END,
         CASE WHEN (total = 19 AND NOT EXISTS (
                      SELECT 1
                      FROM public."_prisma_migrations"
                      WHERE "migration_name" = '20261023000000_add_neon_extensions'
                    ))
                OR (total = 20 AND EXISTS (
                      SELECT 1
                      FROM public."_prisma_migrations"
                      WHERE "migration_name" = '20261023000000_add_neon_extensions'
                        AND "finished_at" IS NOT NULL
                        AND "rolled_back_at" IS NULL
                    ))
              THEN 'PASS' ELSE 'FAIL' END
  FROM ledger
) checks
ORDER BY ord;

\echo ''
\echo '=== 4. Key row counts ==='
SELECT table_name, expected, actual,
       CASE WHEN actual = expected THEN 'PASS' ELSE 'FAIL' END AS result
FROM (
  SELECT 1 AS ord, 'User' AS table_name, 12 AS expected, count(*)::int AS actual
  FROM public."User"

  UNION ALL
  SELECT 2, 'Mod', 225, count(*)::int FROM public."Mod"

  UNION ALL
  SELECT 3, 'Game', 32, count(*)::int FROM public."Game"

  UNION ALL
  SELECT 4, 'Series', 5, count(*)::int FROM public."Series"

  UNION ALL
  SELECT 5, 'Team', 4, count(*)::int FROM public."Team"

  UNION ALL
  SELECT 6, 'ModView', 6223, count(*)::int FROM public."ModView"

  UNION ALL
  SELECT 7, 'DownloadClick', 2, count(*)::int FROM public."DownloadClick"

  UNION ALL
  SELECT 8, 'Endorsement', 10, count(*)::int FROM public."Endorsement"

  UNION ALL
  SELECT 9, 'ModComment', 902, count(*)::int FROM public."ModComment"

  UNION ALL
  SELECT 10, 'AuditLog', 151, count(*)::int FROM public."AuditLog"
) counts
ORDER BY ord;

\echo ''
\echo '=== 5. Full public table row counts (query_to_xml) ==='
\echo 'Expected: exactly 98 rows below.'
WITH public_tables AS (
  SELECT c.relname AS table_name, n.nspname AS schema_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
)
SELECT table_name,
       (xpath(
          '//cnt/text()',
          query_to_xml(
            format('SELECT count(*) AS cnt FROM %I.%I', schema_name, table_name),
            false,
            true,
            ''
          )
        ))[1]::text::bigint AS row_count
FROM public_tables
ORDER BY table_name;

\echo ''
\echo '=== 6. Mod counter invariants (violations only) ==='
\echo 'Expected: 0 rows (any row is a violation).'
WITH view_counts AS (
  SELECT "modId", count(*)::int AS cnt
  FROM public."ModView"
  GROUP BY "modId"
),
download_counts AS (
  SELECT "modId", count(*)::int AS cnt
  FROM public."DownloadClick"
  GROUP BY "modId"
),
positive_endorsement_counts AS (
  SELECT "modId", count(*)::int AS cnt
  FROM public."Endorsement"
  WHERE "value" IN ('fire', 'sparkle', 'thumbsup')
  GROUP BY "modId"
)
SELECT m."id",
       m."slug",
       m."views" AS stored_views,
       m."viewsBaseline" AS views_baseline,
       COALESCE(v.cnt, 0) AS view_rows,
       m."viewsBaseline" + COALESCE(v.cnt, 0) AS expected_views,
       m."views" - (m."viewsBaseline" + COALESCE(v.cnt, 0)) AS views_delta,
       m."downloads" AS stored_downloads,
       m."downloadsBaseline" AS downloads_baseline,
       COALESCE(d.cnt, 0) AS download_rows,
       m."downloadsBaseline" + COALESCE(d.cnt, 0) AS expected_downloads,
       m."downloads" - (m."downloadsBaseline" + COALESCE(d.cnt, 0)) AS downloads_delta,
       m."endorsements" AS stored_endorsements,
       m."endorsementsBaseline" AS endorsements_baseline,
       COALESCE(e.cnt, 0) AS positive_endorsement_rows,
       m."endorsementsBaseline" + COALESCE(e.cnt, 0) AS expected_endorsements,
       m."endorsements" - (m."endorsementsBaseline" + COALESCE(e.cnt, 0)) AS endorsements_delta
FROM public."Mod" m
LEFT JOIN view_counts v ON v."modId" = m."id"
LEFT JOIN download_counts d ON d."modId" = m."id"
LEFT JOIN positive_endorsement_counts e ON e."modId" = m."id"
WHERE m."views" <> m."viewsBaseline" + COALESCE(v.cnt, 0)
   OR m."downloads" <> m."downloadsBaseline" + COALESCE(d.cnt, 0)
   OR m."endorsements" <> m."endorsementsBaseline" + COALESCE(e.cnt, 0)
ORDER BY m."slug";

\echo ''
\echo '=== 7. Game counter invariants (violations only) ==='
\echo 'Expected: 0 rows (any row is a violation).'
WITH published_mods AS (
  SELECT "gameId",
         count(*)::int AS mod_count,
         COALESCE(sum("downloads"), 0)::bigint AS total_downloads,
         COALESCE(sum("endorsements"), 0)::bigint AS total_endorsements
  FROM public."Mod"
  WHERE "workflowStatus" = 'PUBLISHED'
  GROUP BY "gameId"
)
SELECT g."id",
       g."slug",
       g."modCount" AS stored_mod_count,
       COALESCE(p.mod_count, 0) AS expected_mod_count,
       g."totalDownloads" AS stored_total_downloads,
       COALESCE(p.total_downloads, 0) AS expected_total_downloads,
       g."totalEndorsements" AS stored_total_endorsements,
       COALESCE(p.total_endorsements, 0) AS expected_total_endorsements
FROM public."Game" g
LEFT JOIN published_mods p ON p."gameId" = g."id"
WHERE g."modCount" <> COALESCE(p.mod_count, 0)
   OR g."totalDownloads" <> COALESCE(p.total_downloads, 0)
   OR g."totalEndorsements" <> COALESCE(p.total_endorsements, 0)
ORDER BY g."slug";

\echo ''
\echo '=== 8. Series counter invariants (violations only) ==='
\echo 'Expected: 0 rows (any row is a violation).'
WITH series_mods AS (
  SELECT "seriesId",
         count(*)::int AS mod_count,
         COALESCE(sum("downloads"), 0)::bigint AS total_downloads,
         COALESCE(sum("endorsements"), 0)::bigint AS total_endorsements
  FROM public."Mod"
  WHERE "seriesId" IS NOT NULL
  GROUP BY "seriesId"
)
SELECT s."id",
       s."slug",
       s."modCount" AS stored_mod_count,
       COALESCE(m.mod_count, 0) AS expected_mod_count,
       s."totalDownloads" AS stored_total_downloads,
       COALESCE(m.total_downloads, 0) AS expected_total_downloads,
       s."totalEndorsements" AS stored_total_endorsements,
       COALESCE(m.total_endorsements, 0) AS expected_total_endorsements
FROM public."Series" s
LEFT JOIN series_mods m ON m."seriesId" = s."id"
WHERE s."modCount" <> COALESCE(m.mod_count, 0)
   OR s."totalDownloads" <> COALESCE(m.total_downloads, 0)
   OR s."totalEndorsements" <> COALESCE(m.total_endorsements, 0)
ORDER BY s."slug";

\echo ''
\echo '=== 9. dayBucket historical NULL counts ==='
SELECT 'ModView' AS table_name,
       count(*) AS total_rows,
       6223 AS expected_total,
       count(*) FILTER (WHERE "dayBucket" IS NULL) AS null_rows,
       6223 AS expected_null,
       CASE
         WHEN count(*) = 6223
          AND count(*) FILTER (WHERE "dayBucket" IS NULL) = 6223
         THEN 'PASS'
         ELSE 'FAIL'
       END AS result
FROM public."ModView"

UNION ALL

SELECT 'DownloadClick',
       count(*),
       2,
       count(*) FILTER (WHERE "dayBucket" IS NULL),
       2,
       CASE
         WHEN count(*) = 2
          AND count(*) FILTER (WHERE "dayBucket" IS NULL) = 2
         THEN 'PASS'
         ELSE 'FAIL'
       END
FROM public."DownloadClick"

ORDER BY table_name;

\echo ''
\echo '=== 10. User-defined objects in public ==='
\echo 'Expected: 0 for every object type (internal and extension-owned objects are excluded).'
WITH object_counts AS (
  SELECT 'function/procedure' AS object_type, count(*)::int AS object_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT 'materialized view', count(*)::int
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'm'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT 'sequence', count(*)::int
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'S'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT 'trigger', count(*)::int
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_trigger'::regclass
        AND d.objid = t.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT 'view', count(*)::int
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    )
)
SELECT object_type, object_count, 0 AS expected,
       CASE WHEN object_count = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM object_counts
ORDER BY object_type;

\echo ''
\echo '=== 11. Final gate ==='
WITH
ledger_state AS (
  SELECT count(*)::int AS total,
         count(*) FILTER (
           WHERE "finished_at" IS NOT NULL
             AND "rolled_back_at" IS NULL
         )::int AS applied,
         count(*) FILTER (
           WHERE "rolled_back_at" IS NOT NULL
         )::int AS rolled_back,
         count(*) FILTER (
           WHERE "finished_at" IS NULL
             AND "rolled_back_at" IS NULL
         )::int AS unfinished
  FROM public."_prisma_migrations"
),
view_counts AS (
  SELECT "modId", count(*)::int AS cnt
  FROM public."ModView"
  GROUP BY "modId"
),
download_counts AS (
  SELECT "modId", count(*)::int AS cnt
  FROM public."DownloadClick"
  GROUP BY "modId"
),
positive_endorsement_counts AS (
  SELECT "modId", count(*)::int AS cnt
  FROM public."Endorsement"
  WHERE "value" IN ('fire', 'sparkle', 'thumbsup')
  GROUP BY "modId"
),
mod_violations AS (
  SELECT 1
  FROM public."Mod" m
  LEFT JOIN view_counts v ON v."modId" = m."id"
  LEFT JOIN download_counts d ON d."modId" = m."id"
  LEFT JOIN positive_endorsement_counts e ON e."modId" = m."id"
  WHERE m."views" <> m."viewsBaseline" + COALESCE(v.cnt, 0)
     OR m."downloads" <> m."downloadsBaseline" + COALESCE(d.cnt, 0)
     OR m."endorsements" <> m."endorsementsBaseline" + COALESCE(e.cnt, 0)
),
published_game_mods AS (
  SELECT "gameId",
         count(*)::int AS mod_count,
         COALESCE(sum("downloads"), 0)::bigint AS total_downloads,
         COALESCE(sum("endorsements"), 0)::bigint AS total_endorsements
  FROM public."Mod"
  WHERE "workflowStatus" = 'PUBLISHED'
  GROUP BY "gameId"
),
game_violations AS (
  SELECT 1
  FROM public."Game" g
  LEFT JOIN published_game_mods p ON p."gameId" = g."id"
  WHERE g."modCount" <> COALESCE(p.mod_count, 0)
     OR g."totalDownloads" <> COALESCE(p.total_downloads, 0)
     OR g."totalEndorsements" <> COALESCE(p.total_endorsements, 0)
),
series_mods AS (
  SELECT "seriesId",
         count(*)::int AS mod_count,
         COALESCE(sum("downloads"), 0)::bigint AS total_downloads,
         COALESCE(sum("endorsements"), 0)::bigint AS total_endorsements
  FROM public."Mod"
  WHERE "seriesId" IS NOT NULL
  GROUP BY "seriesId"
),
series_violations AS (
  SELECT 1
  FROM public."Series" s
  LEFT JOIN series_mods m ON m."seriesId" = s."id"
  WHERE s."modCount" <> COALESCE(m.mod_count, 0)
     OR s."totalDownloads" <> COALESCE(m.total_downloads, 0)
     OR s."totalEndorsements" <> COALESCE(m.total_endorsements, 0)
),
user_object_counts AS (
  SELECT count(*)::int AS cnt
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT count(*)::int
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'm'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT count(*)::int
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'S'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT count(*)::int
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_trigger'::regclass
        AND d.objid = t.oid
        AND d.deptype = 'e'
    )

  UNION ALL

  SELECT count(*)::int
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    )
),
checks AS (
  SELECT 'schema: 98 public base tables' AS check_name,
         (
           SELECT count(*) = 98
           FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_type = 'BASE TABLE'
         ) AS ok

  UNION ALL

  SELECT 'extensions: pg_trgm + pgcrypto present',
         (
           SELECT count(*) = 2
           FROM pg_extension
           WHERE extname IN ('pg_trgm', 'pgcrypto')
         )

  UNION ALL

  SELECT 'migrations: exact ledger pair (19/18/1 or 20/19/1), unfinished 0, duplicate 2, backup 18, new migration matches',
         (
           SELECT ((total = 19 AND applied = 18) OR (total = 20 AND applied = 19))
                  AND rolled_back = 1
                  AND unfinished = 0
           FROM ledger_state
         )
         AND (
           SELECT count(*)
           FROM public."_prisma_migrations"
           WHERE "migration_name" = '20261008000000_team_owner_unique'
         ) = 2
         AND (
           SELECT count(*)
           FROM public."_prisma_migrations"
           WHERE "migration_name" = '20261008000000_team_owner_unique'
             AND "rolled_back_at" IS NOT NULL
         ) = 1
         AND (SELECT count(*) FROM public."_prisma_migrations_backup_20260920") = 18
         AND (
           SELECT CASE
                    WHEN total = 19 THEN NOT EXISTS (
                      SELECT 1
                      FROM public."_prisma_migrations"
                      WHERE "migration_name" = '20261023000000_add_neon_extensions'
                    )
                    WHEN total = 20 THEN EXISTS (
                      SELECT 1
                      FROM public."_prisma_migrations"
                      WHERE "migration_name" = '20261023000000_add_neon_extensions'
                        AND "finished_at" IS NOT NULL
                        AND "rolled_back_at" IS NULL
                    )
                    ELSE false
                  END
           FROM ledger_state
         )

  UNION ALL

  SELECT 'row counts: 10 key tables',
         NOT EXISTS (
           SELECT 1
           FROM (VALUES
             (12, (SELECT count(*)::int FROM public."User")),
             (225, (SELECT count(*)::int FROM public."Mod")),
             (32, (SELECT count(*)::int FROM public."Game")),
             (5, (SELECT count(*)::int FROM public."Series")),
             (4, (SELECT count(*)::int FROM public."Team")),
             (6223, (SELECT count(*)::int FROM public."ModView")),
             (2, (SELECT count(*)::int FROM public."DownloadClick")),
             (10, (SELECT count(*)::int FROM public."Endorsement")),
             (902, (SELECT count(*)::int FROM public."ModComment")),
             (151, (SELECT count(*)::int FROM public."AuditLog"))
           ) AS expected_counts(expected, actual)
           WHERE expected <> actual
         )

  UNION ALL

  SELECT 'invariants: Mod views/downloads/endorsements',
         NOT EXISTS (SELECT 1 FROM mod_violations)

  UNION ALL

  SELECT 'invariants: Game totals',
         NOT EXISTS (SELECT 1 FROM game_violations)

  UNION ALL

  SELECT 'invariants: Series totals',
         NOT EXISTS (SELECT 1 FROM series_violations)

  UNION ALL

  SELECT 'row buckets: ModView 6223/6223, DownloadClick 2/2',
         (SELECT count(*) FROM public."ModView") = 6223
         AND (SELECT count(*) FROM public."ModView" WHERE "dayBucket" IS NULL) = 6223
         AND (SELECT count(*) FROM public."DownloadClick") = 2
         AND (SELECT count(*) FROM public."DownloadClick" WHERE "dayBucket" IS NULL) = 2

  UNION ALL

  SELECT 'objects: no user-defined routines/triggers/sequences/views/matviews',
         (SELECT COALESCE(sum(cnt), 0) FROM user_object_counts) = 0
)
SELECT CASE
         WHEN EXISTS (SELECT 1 FROM checks WHERE NOT ok) THEN 'true'
         ELSE 'false'
       END AS failed
\gset

\if :failed
\echo 'FAIL: migration verification found one or more violations.'
\quit 3
\else
\echo 'PASS: all migration verification checks passed.'
\endif
