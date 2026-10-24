-- Add member lifecycle and ghost fields to TeamMembership
ALTER TABLE "TeamMembership" ADD COLUMN "ghostName" TEXT;
ALTER TABLE "TeamMembership" ADD COLUMN "ghostEmail" TEXT;
ALTER TABLE "TeamMembership" ADD COLUMN "ghostAvatarUrl" TEXT;
ALTER TABLE "TeamMembership" ADD COLUMN "ghostBio" TEXT;
ALTER TABLE "TeamMembership" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "TeamMembership" ADD COLUMN "leftAt" TIMESTAMP(3);
CREATE INDEX "TeamMembership_teamId_status_idx" ON "TeamMembership"("teamId", "status");
