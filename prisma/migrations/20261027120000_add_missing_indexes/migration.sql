-- Add missing composite indexes for creator/admin query paths.
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_createdAt_idx" ON "AuditLog"("entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "UploadAsset_userId_createdAt_idx" ON "UploadAsset"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModRating_modId_createdAt_idx" ON "ModRating"("modId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModRequest_status_createdAt_idx" ON "ModRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ModRequest_status_interestCount_createdAt_idx" ON "ModRequest"("status", "interestCount", "createdAt");
CREATE INDEX IF NOT EXISTS "TeamMembership_teamId_joinedAt_idx" ON "TeamMembership"("teamId", "joinedAt");
CREATE INDEX IF NOT EXISTS "TeamInvitation_teamId_createdAt_idx" ON "TeamInvitation"("teamId", "createdAt");
