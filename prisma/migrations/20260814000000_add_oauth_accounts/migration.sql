-- Step 1: Create OAuthAccount table
CREATE TABLE IF NOT EXISTS "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "providerUsername" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes and unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
CREATE INDEX IF NOT EXISTS "OAuthAccount_provider_idx" ON "OAuthAccount"("provider");

-- Step 3: Migrate existing data from User to OAuthAccount
INSERT INTO "OAuthAccount" ("id", "userId", "provider", "providerAccountId", "providerEmail", "avatarUrl", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "provider",
    "providerAccountId",
    "email",
    "avatarUrl",
    NOW(),
    NOW()
FROM "User"
WHERE "provider" IS NOT NULL
  AND "provider" != 'email'
  AND "providerAccountId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "OAuthAccount" oa
    WHERE oa."provider" = "User"."provider"
      AND oa."providerAccountId" = "User"."providerAccountId"
  );

-- Step 4: Drop the old columns from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "User" DROP COLUMN IF EXISTS "providerAccountId";
