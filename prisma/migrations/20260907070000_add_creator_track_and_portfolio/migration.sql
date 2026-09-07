-- AlterTable
ALTER TABLE "CreatorRequest" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "agreeToTerms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "portfolioUrls" TEXT,
ADD COLUMN     "samplesCount" INTEGER,
ADD COLUMN     "track" TEXT NOT NULL DEFAULT 'translator';
