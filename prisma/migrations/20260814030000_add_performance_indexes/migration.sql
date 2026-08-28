-- Performance indexes for high-traffic queries
-- Generated: 2026-08-14

-- Game: platform filter on homepage (14+ WHERE queries)
CREATE INDEX IF NOT EXISTS "Game_platform_idx" ON "Game"("platform");
CREATE INDEX IF NOT EXISTS "Game_featured_idx" ON "Game"("featured");
CREATE INDEX IF NOT EXISTS "Game_totalDownloads_idx" ON "Game"("totalDownloads");

-- Mod: ORDER BY downloads/endorsements (10+ queries each)
CREATE INDEX IF NOT EXISTS "Mod_downloads_idx" ON "Mod"("downloads");
CREATE INDEX IF NOT EXISTS "Mod_endorsements_idx" ON "Mod"("endorsements");
CREATE INDEX IF NOT EXISTS "Mod_createdAt_idx" ON "Mod"("createdAt");

-- Endorsement: modId-only lookups (admin, fraud, trust)
CREATE INDEX IF NOT EXISTS "Endorsement_modId_idx" ON "Endorsement"("modId");

-- ModComment: no indexes existed at all
CREATE INDEX IF NOT EXISTS "ModComment_modId_idx" ON "ModComment"("modId");
CREATE INDEX IF NOT EXISTS "ModComment_userId_idx" ON "ModComment"("userId");
CREATE INDEX IF NOT EXISTS "ModComment_parentId_idx" ON "ModComment"("parentId");
CREATE INDEX IF NOT EXISTS "ModComment_createdAt_idx" ON "ModComment"("createdAt");

-- User: admin filters and sorting
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_joinedAt_idx" ON "User"("joinedAt");
CREATE INDEX IF NOT EXISTS "User_lastLoginAt_idx" ON "User"("lastLoginAt");
CREATE INDEX IF NOT EXISTS "User_banStatus_idx" ON "User"("banStatus");

-- UserAction: action filter in reports stats
CREATE INDEX IF NOT EXISTS "UserAction_action_idx" ON "UserAction"("action");

-- NotificationLog: FK without index
CREATE INDEX IF NOT EXISTS "NotificationLog_notificationId_idx" ON "notification_logs"("notification_id");

-- ModTeamMember: FK without index
CREATE INDEX IF NOT EXISTS "ModTeamMember_modId_idx" ON "ModTeamMember"("modId");

-- ModContactLink: FK without index
CREATE INDEX IF NOT EXISTS "ModContactLink_modId_idx" ON "ModContactLink"("modId");

-- ModFileLink: FK without index
CREATE INDEX IF NOT EXISTS "ModFileLink_fileId_idx" ON "ModFileLink"("fileId");

-- TeamContactLink: FK without index
CREATE INDEX IF NOT EXISTS "TeamContactLink_teamId_idx" ON "TeamContactLink"("teamId");

-- TeamMembership: userId-only lookups
CREATE INDEX IF NOT EXISTS "TeamMembership_userId_idx" ON "TeamMembership"("userId");
