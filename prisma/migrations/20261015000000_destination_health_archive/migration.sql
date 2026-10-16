-- AlterTable
ALTER TABLE "telegram_destinations" ADD COLUMN     "last_health_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_health_error" TEXT,
ADD COLUMN     "post_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "archived_at" TIMESTAMPTZ(6);
