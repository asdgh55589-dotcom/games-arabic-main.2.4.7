-- Idempotency guard for IA relay retries. Postgres allows multiple NULL
-- storageKey values, so legacy/direct assets are unaffected.
CREATE UNIQUE INDEX "UploadAsset_userId_storageKey_key" ON "UploadAsset"("userId", "storageKey");
