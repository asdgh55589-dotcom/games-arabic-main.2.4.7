-- AlterTable
ALTER TABLE "telegram_destinations" ADD COLUMN     "last_health_at" TIMESTAMP(3),
ADD COLUMN     "last_health_error" TEXT,
ADD COLUMN     "post_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "archived_at" TIMESTAMP(3);
