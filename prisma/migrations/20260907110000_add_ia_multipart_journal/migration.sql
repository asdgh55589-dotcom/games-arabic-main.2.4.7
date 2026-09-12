-- IA SAFE-multipart journal (resume without re-upload).
-- Safe additive migration: new table only, no backfill.

CREATE TABLE IF NOT EXISTS "IaMultipartUpload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "modId" TEXT,
  "key" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "totalBytes" BIGINT NOT NULL,
  "partSize" INTEGER NOT NULL DEFAULT 5242880,
  "totalParts" INTEGER NOT NULL,
  "parts" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'initiated',
  "downloadUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IaMultipartUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IaMultipartUpload_uploadId_key" ON "IaMultipartUpload"("uploadId");
CREATE INDEX IF NOT EXISTS "IaMultipartUpload_userId_idx" ON "IaMultipartUpload"("userId");
CREATE INDEX IF NOT EXISTS "IaMultipartUpload_status_idx" ON "IaMultipartUpload"("status");
