-- AlterTable
ALTER TABLE "Mod" ADD COLUMN     "extrasLabel" TEXT;

-- AlterTable
ALTER TABLE "ModFile" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "extrasLabel" TEXT;

-- CreateTable
CREATE TABLE "CompatibleSite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domains" JSONB NOT NULL DEFAULT '[]',
    "logoUrl" TEXT,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompatibleSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModSiteLink" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "siteName" TEXT,
    "pageTitle" TEXT,
    "domain" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModSiteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModFile_parentId_idx" ON "ModFile"("parentId");
CREATE INDEX "ModSiteLink_modId_idx" ON "ModSiteLink"("modId");
CREATE INDEX "ModSiteLink_fileId_idx" ON "ModSiteLink"("fileId");

-- AddForeignKey
ALTER TABLE "ModFile" ADD CONSTRAINT "ModFile_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ModFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModSiteLink" ADD CONSTRAINT "ModSiteLink_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModSiteLink" ADD CONSTRAINT "ModSiteLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ModFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
