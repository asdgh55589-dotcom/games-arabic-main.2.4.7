-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_targetModId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_targetCommentId_fkey";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "snapshot" JSONB;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetModId_fkey" FOREIGN KEY ("targetModId") REFERENCES "Mod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetCommentId_fkey" FOREIGN KEY ("targetCommentId") REFERENCES "ModComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

