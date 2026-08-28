-- AlterTable: Add quietHours and typePreferences to NotificationPreference
ALTER TABLE "notification_preferences" ADD COLUMN "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notification_preferences" ADD COLUMN "quiet_hours_start" TEXT;
ALTER TABLE "notification_preferences" ADD COLUMN "quiet_hours_end" TEXT;
ALTER TABLE "notification_preferences" ADD COLUMN "type_preferences" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: NotificationJob
CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_error" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_jobs_status_scheduled_for_idx" ON "notification_jobs"("status", "scheduled_for");
CREATE INDEX "notification_jobs_notification_id_idx" ON "notification_jobs"("notification_id");
CREATE INDEX "notification_jobs_channel_idx" ON "notification_jobs"("channel");

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
