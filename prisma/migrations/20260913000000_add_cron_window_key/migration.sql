ALTER TABLE "ScheduledJob" ADD COLUMN "windowKey" TEXT;

CREATE UNIQUE INDEX "ScheduledJob_type_windowKey_key" ON "ScheduledJob"("type", "windowKey");
