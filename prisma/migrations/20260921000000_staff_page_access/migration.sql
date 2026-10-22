-- CreateTable
-- NOTE: This migration is intentionally idempotent. The baseline squash already
-- contains StaffPageAccess, so a fresh `prisma migrate deploy` would otherwise
-- fail on this historical additive migration. The live ledger is unchanged
-- (the migration is already applied there).
CREATE TABLE IF NOT EXISTS "StaffPageAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPageAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffPageAccess_userId_page_key" ON "StaffPageAccess"("userId", "page");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffPageAccess_userId_idx" ON "StaffPageAccess"("userId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StaffPageAccess_userId_fkey'
      AND conrelid = 'public."StaffPageAccess"'::regclass
  ) THEN
    ALTER TABLE "StaffPageAccess"
      ADD CONSTRAINT "StaffPageAccess_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
