-- Add platform-specific localization fields to Mod (all optional, per-platform)
ALTER TABLE "Mod" ADD COLUMN "translationMethod" TEXT;
ALTER TABLE "Mod" ADD COLUMN "platformGameId" TEXT;
ALTER TABLE "Mod" ADD COLUMN "cusaId" TEXT;
ALTER TABLE "Mod" ADD COLUMN "ppsaId" TEXT;
ALTER TABLE "Mod" ADD COLUMN "titleId" TEXT;
ALTER TABLE "Mod" ADD COLUMN "mediaId" TEXT;
ALTER TABLE "Mod" ADD COLUMN "supportedFormat" TEXT;
ALTER TABLE "Mod" ADD COLUMN "systemFirmware" TEXT;
ALTER TABLE "Mod" ADD COLUMN "gameUpdateVersion" TEXT;
ALTER TABLE "Mod" ADD COLUMN "deviceModel" TEXT;
ALTER TABLE "Mod" ADD COLUMN "installType" TEXT;
ALTER TABLE "Mod" ADD COLUMN "cpuArch" TEXT;
ALTER TABLE "Mod" ADD COLUMN "gameVersion" TEXT;
ALTER TABLE "Mod" ADD COLUMN "minAndroidVersion" TEXT;
