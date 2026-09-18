-- DropIndex
DROP INDEX "idx_mod_arabic_title_trgm";

-- DropIndex
DROP INDEX "idx_mod_name_trgm";

-- DropIndex
DROP INDEX "idx_mod_summary_trgm";

-- DropIndex
DROP INDEX "idx_user_display_name_trgm";

-- DropIndex
DROP INDEX "idx_user_email_trgm";

-- DropIndex
DROP INDEX "idx_user_username_trgm";

-- CreateTable
CREATE TABLE "VideoMetadataCache" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "channel" TEXT,
    "thumbnail" TEXT,
    "duration" TEXT,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'yt-dlp',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoMetadataCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoMetadataCache_url_key" ON "VideoMetadataCache"("url");

-- CreateIndex
CREATE INDEX "VideoMetadataCache_provider_idx" ON "VideoMetadataCache"("provider");

-- CreateIndex
CREATE INDEX "VideoMetadataCache_expiresAt_idx" ON "VideoMetadataCache"("expiresAt");
