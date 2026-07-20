-- AlterTable
ALTER TABLE "User" ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "specialRoles" TEXT NOT NULL DEFAULT '',
ADD COLUMN "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastTierUpgradeAt" TIMESTAMP(3),
ADD COLUMN "tierUpgradeCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TierRule" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "requiredMods" INTEGER NOT NULL DEFAULT 0,
    "requiredDownloads" INTEGER NOT NULL DEFAULT 0,
    "requiredRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiredQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badge" TEXT NOT NULL DEFAULT '',
    "badgeColor" TEXT NOT NULL DEFAULT '#6b7280',
    "features" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromTier" INTEGER NOT NULL,
    "toTier" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'auto',
    "triggeredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TierHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Star',
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TierRule_tier_key" ON "TierRule"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialRole_key_key" ON "SpecialRole"("key");

-- CreateIndex
CREATE INDEX "TierHistory_userId_idx" ON "TierHistory"("userId");

-- CreateIndex
CREATE INDEX "TierHistory_createdAt_idx" ON "TierHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "TierHistory" ADD CONSTRAINT "TierHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
