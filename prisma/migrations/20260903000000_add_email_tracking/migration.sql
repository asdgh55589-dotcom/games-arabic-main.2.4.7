-- AlterTable
ALTER TABLE "notification_logs" ADD COLUMN "delivered_at" TIMESTAMP(3);
ALTER TABLE "notification_logs" ADD COLUMN "opened_at" TIMESTAMP(3);
ALTER TABLE "notification_logs" ADD COLUMN "clicked_at" TIMESTAMP(3);
