-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "target_type" TEXT;
ALTER TABLE "notifications" ADD COLUMN "target_id" TEXT;
ALTER TABLE "notifications" ADD COLUMN "target_slug" TEXT;
ALTER TABLE "notifications" ADD COLUMN "target_title" TEXT;
ALTER TABLE "notifications" ADD COLUMN "target_url" TEXT;
ALTER TABLE "notifications" ADD COLUMN "actor_username" TEXT;
ALTER TABLE "notifications" ADD COLUMN "actor_avatar_url" TEXT;
