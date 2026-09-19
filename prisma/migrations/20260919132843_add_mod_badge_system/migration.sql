-- AlterTable
ALTER TABLE "Mod" ADD COLUMN     "dailyDownloads" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "featuredLevel" INTEGER,
ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "hiddenBadges" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastDownloadDate" TIMESTAMP(3),
ADD COLUMN     "popularUntil" TIMESTAMP(3),
ADD COLUMN     "trendingUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BadgeSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "trendingThreshold" INTEGER NOT NULL DEFAULT 50,
    "popularThreshold" INTEGER NOT NULL DEFAULT 20,
    "newDurationHours" INTEGER NOT NULL DEFAULT 48,
    "updatedDurationHours" INTEGER NOT NULL DEFAULT 24,
    "featuredTiers" JSONB,
    "badgesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeAuditLog" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BadgeAuditLog_modId_idx" ON "BadgeAuditLog"("modId");

-- CreateIndex
CREATE INDEX "BadgeAuditLog_createdAt_idx" ON "BadgeAuditLog"("createdAt");
