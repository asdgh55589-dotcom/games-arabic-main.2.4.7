-- NOTE (reviewed, intentional): Prisma's generator also emitted
-- `DROP INDEX` statements for the six pg_trgm indexes here. They were
-- removed before applying: those indexes belong to the committed baseline
-- tail (20260907000000_baseline, commit 415f698 "add pg_trgm for fresh
-- deploys"), exist in production, and are invisible to the Prisma
-- datamodel (GIN-trgm is not modelable), so the differ always flags them.
-- Dropping them would regress search performance with zero benefit.
-- This migration is therefore CREATE-only for TeamInvitation.
-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "inviteeUsername" TEXT,
    "inviteeEmail" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TeamInvitation_teamId_idx" ON "TeamInvitation"("teamId");

-- CreateIndex
CREATE INDEX "TeamInvitation_teamId_status_idx" ON "TeamInvitation"("teamId", "status");

-- CreateIndex
CREATE INDEX "TeamInvitation_invitedUserId_idx" ON "TeamInvitation"("invitedUserId");

-- CreateIndex
CREATE INDEX "TeamInvitation_status_expiresAt_idx" ON "TeamInvitation"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
