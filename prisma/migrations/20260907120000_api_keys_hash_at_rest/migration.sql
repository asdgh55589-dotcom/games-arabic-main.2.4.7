-- API keys at rest: SHA-256 hash + 8-char prefix (audit D.2).
-- Backfills existing raw keys IN DATABASE (no rotation needed — hashes of
-- the same raws keep working), then enforces NOT NULL. The raw `key`
-- column is kept nullable for now and dropped by a later cleanup
-- migration; new rows store NULL there (raw shown once at creation only).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "keyHash" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "keyPrefix" TEXT NOT NULL DEFAULT '';

-- Backfill: hash + prefix from the stored raw values (idempotent).
UPDATE "ApiKey"
SET "keyHash" = encode(digest("key", 'sha256'), 'hex'),
    "keyPrefix" = substring("key" from 9 for 8)
WHERE "keyHash" IS NULL AND "key" IS NOT NULL;

ALTER TABLE "ApiKey" ALTER COLUMN "key" DROP NOT NULL;
ALTER TABLE "ApiKey" ALTER COLUMN "keyHash" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
