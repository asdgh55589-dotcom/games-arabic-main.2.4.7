-- GAM-8/A3: one team per owner (backstop for concurrent POST /api/creator/team).
-- ownerId is nullable; Postgres permits multiple NULLs so legacy null rows are unaffected.
-- Pre-existing duplicate ownerIds (if any) must be merged before deploy or this fails.
CREATE UNIQUE INDEX IF NOT EXISTS "Team_ownerId_key" ON "Team"("ownerId");
