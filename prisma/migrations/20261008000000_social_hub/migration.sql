-- AlterTable
ALTER TABLE "telegram_destinations" ADD COLUMN     "bot_id" TEXT,
ADD COLUMN     "message_thread_id" INTEGER;

-- CreateTable
CREATE TABLE "social_telegram_bots" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bot_username" TEXT,
    "token_enc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_telegram_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'telegram',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "parseMode" TEXT,
    "rich_document" JSONB,
    "media_url" TEXT,
    "media_type" TEXT,
    "destination_id" TEXT,
    "bot_id" TEXT,
    "template_id" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "external_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_templates" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'telegram',
    "name" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "parse_mode" TEXT,
    "rich_document" JSONB,
    "media_url" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_post_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_telegram_bots_status_idx" ON "social_telegram_bots"("status");

-- CreateIndex
CREATE INDEX "social_telegram_bots_created_at_idx" ON "social_telegram_bots"("created_at");

-- CreateIndex
CREATE INDEX "social_posts_platform_status_idx" ON "social_posts"("platform", "status");

-- CreateIndex
CREATE INDEX "social_posts_status_scheduled_for_idx" ON "social_posts"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "social_posts_created_at_idx" ON "social_posts"("created_at");

-- CreateIndex
CREATE INDEX "social_post_templates_platform_idx" ON "social_post_templates"("platform");

-- CreateIndex
CREATE INDEX "telegram_destinations_bot_id_idx" ON "telegram_destinations"("bot_id");

-- AddForeignKey
ALTER TABLE "telegram_destinations" ADD CONSTRAINT "telegram_destinations_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "social_telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "telegram_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "social_post_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "social_telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

