-- AlterTable
ALTER TABLE "User" ADD COLUMN "securityKey" TEXT;
ALTER TABLE "User" ADD COLUMN "securityKeyExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "securityKeyChangedAt" TIMESTAMP(3);
