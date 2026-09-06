-- CreateIndex (composite time-series lookups for creator likes analytics).
-- NOTE: an earlier revision of this file contained DROP INDEX statements
-- for the six idx_*_trgm indexes (auto-generated from raw-SQL drift: trigram
-- indexes are not modelable in schema.prisma). Those DROPs broke future
-- `migrate dev` runs (Prisma state validation P3006) and deleted prod-grade
-- search indexes — they were removed here. NEVER add DROP INDEX for
-- idx_*_trgm to a migration; see docs/prod-migration-sync.md §7.
CREATE INDEX "CommentLike_commentId_createdAt_idx" ON "CommentLike"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "Endorsement_modId_createdAt_idx" ON "Endorsement"("modId", "createdAt");
