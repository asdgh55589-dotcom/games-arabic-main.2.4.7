-- Comment depth column (eliminates full-table depth scan on reply) + missing
-- composite indexes ((modId,createdAt) and (userId,createdAt) existed only in
-- schema.prisma, never migrated) + public-list index (modId,isHidden,createdAt).
-- Safe additive migration: new column has DEFAULT, backfill is idempotent.

ALTER TABLE "ModComment" ADD COLUMN IF NOT EXISTS "depth" INTEGER NOT NULL DEFAULT 0;

-- Backfill depth from the parent chain (roots stay 0). Idempotent: re-running
-- recomputes identical values.
WITH RECURSIVE tree AS (
  SELECT "id", "parentId", 0 AS d FROM "ModComment" WHERE "parentId" IS NULL
  UNION ALL
  SELECT c."id", c."parentId", t.d + 1
  FROM "ModComment" c
  JOIN tree t ON c."parentId" = t.id
)
UPDATE "ModComment" m SET "depth" = t.d FROM tree t WHERE m."id" = t.id;

-- Level/reply lookups (DELETE BFS + paginated reply fetch filter modId+parentId)
CREATE INDEX IF NOT EXISTS "ModComment_modId_parentId_idx" ON "ModComment"("modId", "parentId");

-- Public list filter (modId + isHidden) with recency ordering
CREATE INDEX IF NOT EXISTS "ModComment_modId_isHidden_createdAt_idx"
  ON "ModComment"("modId", "isHidden", "createdAt");

-- Composite indexes that existed in schema.prisma but were never migrated
CREATE INDEX IF NOT EXISTS "ModComment_modId_createdAt_idx" ON "ModComment"("modId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModComment_userId_createdAt_idx" ON "ModComment"("userId", "createdAt");
