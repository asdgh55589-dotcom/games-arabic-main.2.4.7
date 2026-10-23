-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Team_archivedAt_idx" ON "Team"("archivedAt");

