-- Phase 2: professional upload providers + quotas (additive only)
-- NOTE: written by hand because `migrate dev` is blocked by PRE-EXISTING
-- drift (20260720000000_add_tier_system fails on the shadow DB — User table
-- missing there; unrelated to this change). Validated via `prisma db push`.

-- Extend ModFileLink with provider tracking (existing rows → 'direct')
ALTER TABLE "ModFileLink" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE "ModFileLink" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "ModFileLink" ADD COLUMN "wrappedUrl" TEXT;
ALTER TABLE "ModFileLink" ADD COLUMN "bytes" BIGINT;
ALTER TABLE "ModFileLink" ADD COLUMN "mime" TEXT;
ALTER TABLE "ModFileLink" ADD COLUMN "checksum" TEXT;
ALTER TABLE "ModFileLink" ADD COLUMN "uploadedBy" TEXT;
CREATE INDEX "ModFileLink_provider_idx" ON "ModFileLink"("provider");

-- Audit rows for non-direct uploads (quotas + admin visibility)
CREATE TABLE "UploadAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modId" TEXT,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "wrappedUrl" TEXT,
    "storageKey" TEXT,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "mime" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UploadAsset_userId_idx" ON "UploadAsset"("userId");
CREATE INDEX "UploadAsset_modId_idx" ON "UploadAsset"("modId");
CREATE INDEX "UploadAsset_provider_idx" ON "UploadAsset"("provider");
CREATE INDEX "UploadAsset_createdAt_idx" ON "UploadAsset"("createdAt");

-- Rank-based quota defaults (owner-editable via admin panel)
CREATE TABLE "QuotaPolicy" (
    "id" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "uploadsPerDay" INTEGER NOT NULL DEFAULT 10,
    "maxFileBytes" BIGINT NOT NULL DEFAULT 2147483648,
    "totalBytes" BIGINT NOT NULL DEFAULT 21474836480,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuotaPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotaPolicy_rank_key" ON "QuotaPolicy"("rank");

-- Per-user quota exceptions (NULL = inherit rank default)
CREATE TABLE "QuotaOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadsPerDay" INTEGER,
    "maxFileBytes" BIGINT,
    "totalBytes" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuotaOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotaOverride_userId_key" ON "QuotaOverride"("userId");
CREATE INDEX "QuotaOverride_userId_idx" ON "QuotaOverride"("userId");

-- Daily counters (new row per UTC day = automatic reset, no cron)
CREATE TABLE "UploadUsageDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadUsageDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UploadUsageDaily_userId_date_key" ON "UploadUsageDaily"("userId", "date");
CREATE INDEX "UploadUsageDaily_date_idx" ON "UploadUsageDaily"("date");

-- Lifetime storage footprint per creator
CREATE TABLE "CreatorStorage" (
    "userId" TEXT NOT NULL,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "filesCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorStorage_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX "CreatorStorage_userId_idx" ON "CreatorStorage"("userId");
