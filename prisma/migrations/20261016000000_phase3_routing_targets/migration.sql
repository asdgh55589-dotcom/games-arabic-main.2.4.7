-- CreateTable
CREATE TABLE "social_publish_routes" (
    "id" TEXT NOT NULL,
    "platform_key" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "destination_id" TEXT NOT NULL,
    "bot_id" TEXT,
    "thread_id" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_publish_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_targets" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "destination_id" TEXT NOT NULL,
    "bot_id" TEXT,
    "thread_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "external_message_id" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_post_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_deliveries" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "destination_id" TEXT NOT NULL,
    "bot_id" TEXT,
    "thread_id" INTEGER,
    "status" TEXT NOT NULL,
    "external_message_id" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_post_targets_post_id_destination_id_thread_id_key" ON "social_post_targets"("post_id", "destination_id", "thread_id");
CREATE INDEX "social_publish_routes_platform_key_is_active_idx" ON "social_publish_routes"("platform_key", "is_active");
CREATE INDEX "social_publish_routes_destination_id_idx" ON "social_publish_routes"("destination_id");
CREATE INDEX "social_post_targets_post_id_status_idx" ON "social_post_targets"("post_id", "status");
CREATE INDEX "social_post_deliveries_post_id_created_at_idx" ON "social_post_deliveries"("post_id", "created_at");
CREATE INDEX "social_post_deliveries_destination_id_idx" ON "social_post_deliveries"("destination_id");

-- AddForeignKey
ALTER TABLE "social_publish_routes" ADD CONSTRAINT "social_publish_routes_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "telegram_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_publish_routes" ADD CONSTRAINT "social_publish_routes_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "social_telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "telegram_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "social_telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_post_deliveries" ADD CONSTRAINT "social_post_deliveries_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_post_deliveries" ADD CONSTRAINT "social_post_deliveries_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "telegram_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_post_deliveries" ADD CONSTRAINT "social_post_deliveries_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "social_telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
