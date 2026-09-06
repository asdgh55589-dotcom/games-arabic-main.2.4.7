-- DropIndex
DROP INDEX "idx_mod_arabic_title_trgm";

-- DropIndex
DROP INDEX "idx_mod_name_trgm";

-- DropIndex
DROP INDEX "idx_mod_summary_trgm";

-- DropIndex
DROP INDEX "idx_user_display_name_trgm";

-- DropIndex
DROP INDEX "idx_user_email_trgm";

-- DropIndex
DROP INDEX "idx_user_username_trgm";

-- CreateIndex
CREATE INDEX "CommentLike_commentId_createdAt_idx" ON "CommentLike"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "Endorsement_modId_createdAt_idx" ON "Endorsement"("modId", "createdAt");
