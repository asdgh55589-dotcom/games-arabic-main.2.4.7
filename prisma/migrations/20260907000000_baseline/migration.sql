-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('new', 'under_review', 'confirmed', 'rejected', 'pending', 'resolved', 'reopened');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('mod', 'comment', 'user', 'team');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'inappropriate', 'copyright', 'offensive', 'false_info', 'technical', 'other');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ReportAction" AS ENUM ('none', 'warned', 'content_hidden', 'content_deleted', 'temp_ban', 'perm_ban');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "bio" TEXT,
    "websiteUrl" TEXT,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "youtubeUrl" TEXT,
    "githubUrl" TEXT,
    "discordUrl" TEXT,
    "telegramUrl" TEXT,
    "accentColor" TEXT DEFAULT '#ff8c00',
    "profileVisibility" TEXT NOT NULL DEFAULT 'everyone',
    "hideJoinDate" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'member',
    "bannedUntil" TIMESTAMP(3),
    "banStatus" TEXT NOT NULL DEFAULT 'active',
    "banReason" TEXT,
    "bannedBy" TEXT,
    "bannedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "securityKey" TEXT,
    "securityKeyExpiresAt" TIMESTAMP(3),
    "securityKeyChangedAt" TIMESTAMP(3),
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webauthnCredentials" JSONB,
    "mfaRequiredAt" TIMESTAMP(3),
    "mfaEnabledAt" TIMESTAMP(3),
    "recoveryCodes" TEXT,
    "recoveryCodesUsed" JSONB,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "specialRoles" TEXT NOT NULL DEFAULT '',
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastTierUpgradeAt" TIMESTAMP(3),
    "tierUpgradeCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experience" TEXT,
    "preferredGames" TEXT,
    "portfolioLinks" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "twitterUrl" TEXT,
    "youtubeUrl" TEXT,
    "discordHandle" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
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

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bannerUrl" TEXT NOT NULL,
    "logoUrl" TEXT,
    "thumbnailUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "modCount" INTEGER NOT NULL DEFAULT 0,
    "totalDownloads" INTEGER NOT NULL DEFAULT 0,
    "totalEndorsements" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mod" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "changelog" TEXT NOT NULL DEFAULT '',
    "installGuide" TEXT NOT NULL DEFAULT '',
    "arabicTitle" TEXT NOT NULL DEFAULT '',
    "translationScope" TEXT NOT NULL DEFAULT '',
    "compatibility" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "categoryId" TEXT,
    "thumbnailUrl" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "galleryUrls" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileSize" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "endorsements" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT '',
    "seriesId" TEXT,
    "translationTeam" TEXT NOT NULL DEFAULT '',
    "teamId" TEXT,
    "sectionId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "translationType" TEXT NOT NULL DEFAULT 'unofficial',
    "isOriginalWork" BOOLEAN NOT NULL DEFAULT true,
    "originalSource" TEXT,
    "originalAuthor" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reviewerId" TEXT,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityRatingsCount" INTEGER NOT NULL DEFAULT 0,
    "qualityRatingsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityRating" DOUBLE PRECISION,
    "isLatestVersion" BOOLEAN NOT NULL DEFAULT true,
    "previousVersionId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "scheduledPost" TEXT,
    "scheduledSent" BOOLEAN NOT NULL DEFAULT false,
    "scheduledSentAt" TIMESTAMP(3),

    CONSTRAINT "Mod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEntry" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "WorkflowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModVersion" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ModVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT 'up',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModFile" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "versionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "alert" TEXT,
    "version" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fileSize" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModFileLink" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL DEFAULT 'direct',
    "storageKey" TEXT,
    "wrappedUrl" TEXT,
    "bytes" BIGINT,
    "mime" TEXT,
    "checksum" TEXT,
    "uploadedBy" TEXT,

    CONSTRAINT "ModFileLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModVideoGroup" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModVideoGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModVideo" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "duration" TEXT,
    "description" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT,
    "publishedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModTeamMember" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'مترجم',
    "contribution" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModContactLink" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModContactLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModCustomTab" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModCustomTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "bannerUrl" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "modCount" INTEGER NOT NULL DEFAULT 0,
    "totalDownloads" INTEGER NOT NULL DEFAULT 0,
    "totalEndorsements" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "bannerUrl" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "discordUrl" TEXT NOT NULL DEFAULT '',
    "telegramUrl" TEXT NOT NULL DEFAULT '',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "modCount" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "hiddenTabs" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamFollow" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "bio" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamContactLink" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeamContactLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCustomTab" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeamCustomTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "byUserId" TEXT,
    "byUsername" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierRule" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "requiredMods" INTEGER NOT NULL DEFAULT 0,
    "requiredDownloads" INTEGER NOT NULL DEFAULT 0,
    "requiredRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiredQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badge" TEXT NOT NULL DEFAULT '',
    "badgeColor" TEXT NOT NULL DEFAULT '#6b7280',
    "features" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromTier" INTEGER NOT NULL,
    "toTier" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'auto',
    "triggeredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TierHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Star',
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "linkUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "type" TEXT NOT NULL DEFAULT 'ticker',
    "isSticky" BOOLEAN NOT NULL DEFAULT false,
    "isAnimated" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsView" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsClick" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModComment" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT NOT NULL DEFAULT 'زائر',
    "guestAvatar" TEXT,
    "parentId" TEXT,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "dislikes" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "storeLink" TEXT,
    "storeLinks" TEXT,
    "translationType" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "modId" TEXT,
    "interestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageAd" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'youtube',
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "size" TEXT NOT NULL DEFAULT 'medium',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomepageAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdClick" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "target_slug" TEXT,
    "target_title" TEXT,
    "target_url" TEXT,
    "actor_username" TEXT,
    "actor_avatar_url" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_summary" BOOLEAN NOT NULL DEFAULT true,
    "summary_interval_days" INTEGER NOT NULL DEFAULT 3,
    "like_threshold" INTEGER NOT NULL DEFAULT 25,
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "type_preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpBan" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT,
    "bannedBy" TEXT,
    "bannedByUsername" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrustScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "reportAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "confirmedReports" INTEGER NOT NULL DEFAULT 0,
    "rejectedReports" INTEGER NOT NULL DEFAULT 0,
    "reportsReceived" INTEGER NOT NULL DEFAULT 0,
    "reportsReceivedConfirmed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "targetType" "ReportType" NOT NULL,
    "targetModId" TEXT,
    "targetCommentId" TEXT,
    "targetUserId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "priority" "ReportPriority" NOT NULL DEFAULT 'medium',
    "description" TEXT,
    "evidenceUrls" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'new',
    "assignedToId" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "actionTaken" "ReportAction",
    "actionAt" TIMESTAMP(3),
    "fraudScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repeatOffenseLevel" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFraudSignal" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFraudSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportStatusHistory" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fromStatus" "ReportStatus",
    "toStatus" "ReportStatus" NOT NULL,
    "action" "ReportAction",
    "resolution" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT 'like',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Monitor',
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadClick" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "fileId" TEXT,
    "linkId" TEXT,
    "linkUrl" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModView" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "modId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModRating" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTag" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "requirement" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAchievement" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "TeamAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPoints" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchClick" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformView" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UTMTracking" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UTMTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokenImage" (
    "id" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'detected',

    CONSTRAINT "BrokenImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageHealthLog" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "checked" INTEGER NOT NULL,
    "broken" INTEGER NOT NULL,
    "modsAffected" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modId" TEXT,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "wrappedUrl" TEXT,
    "storageKey" TEXT,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "mime" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaPolicy" (
    "id" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "uploadsPerDay" INTEGER NOT NULL DEFAULT 10,
    "maxFileBytes" BIGINT NOT NULL DEFAULT 2147483648,
    "totalBytes" BIGINT NOT NULL DEFAULT 21474836480,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadsPerDay" INTEGER,
    "maxFileBytes" BIGINT,
    "totalBytes" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadUsageDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorStorage" (
    "userId" TEXT NOT NULL,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "filesCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_joinedAt_idx" ON "User"("joinedAt");

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- CreateIndex
CREATE INDEX "User_banStatus_idx" ON "User"("banStatus");

-- CreateIndex
CREATE INDEX "CreatorRequest_status_idx" ON "CreatorRequest"("status");

-- CreateIndex
CREATE INDEX "CreatorRequest_userId_idx" ON "CreatorRequest"("userId");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "Game_platform_idx" ON "Game"("platform");

-- CreateIndex
CREATE INDEX "Game_featured_idx" ON "Game"("featured");

-- CreateIndex
CREATE INDEX "Game_totalDownloads_idx" ON "Game"("totalDownloads");

-- CreateIndex
CREATE UNIQUE INDEX "Category_gameId_slug_key" ON "Category"("gameId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Mod_slug_key" ON "Mod"("slug");

-- CreateIndex
CREATE INDEX "Mod_authorId_idx" ON "Mod"("authorId");

-- CreateIndex
CREATE INDEX "Mod_gameId_idx" ON "Mod"("gameId");

-- CreateIndex
CREATE INDEX "Mod_categoryId_idx" ON "Mod"("categoryId");

-- CreateIndex
CREATE INDEX "Mod_seriesId_idx" ON "Mod"("seriesId");

-- CreateIndex
CREATE INDEX "Mod_teamId_idx" ON "Mod"("teamId");

-- CreateIndex
CREATE INDEX "Mod_sectionId_idx" ON "Mod"("sectionId");

-- CreateIndex
CREATE INDEX "Mod_isFeatured_idx" ON "Mod"("isFeatured");

-- CreateIndex
CREATE INDEX "Mod_isTrending_idx" ON "Mod"("isTrending");

-- CreateIndex
CREATE INDEX "Mod_isLatest_idx" ON "Mod"("isLatest");

-- CreateIndex
CREATE INDEX "Mod_releaseDate_idx" ON "Mod"("releaseDate");

-- CreateIndex
CREATE INDEX "Mod_updatedAt_idx" ON "Mod"("updatedAt");

-- CreateIndex
CREATE INDEX "Mod_translationType_idx" ON "Mod"("translationType");

-- CreateIndex
CREATE INDEX "Mod_downloads_idx" ON "Mod"("downloads");

-- CreateIndex
CREATE INDEX "Mod_endorsements_idx" ON "Mod"("endorsements");

-- CreateIndex
CREATE INDEX "Mod_createdAt_idx" ON "Mod"("createdAt");

-- CreateIndex
CREATE INDEX "Mod_workflowStatus_idx" ON "Mod"("workflowStatus");

-- CreateIndex
CREATE INDEX "Mod_qualityScore_idx" ON "Mod"("qualityScore");

-- CreateIndex
CREATE INDEX "Mod_gameId_downloads_idx" ON "Mod"("gameId", "downloads");

-- CreateIndex
CREATE INDEX "Mod_gameId_updatedAt_idx" ON "Mod"("gameId", "updatedAt");

-- CreateIndex
CREATE INDEX "Mod_seriesId_downloads_idx" ON "Mod"("seriesId", "downloads");

-- CreateIndex
CREATE INDEX "Mod_authorId_createdAt_idx" ON "Mod"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowEntry_modId_idx" ON "WorkflowEntry"("modId");

-- CreateIndex
CREATE INDEX "WorkflowEntry_changedBy_idx" ON "WorkflowEntry"("changedBy");

-- CreateIndex
CREATE INDEX "WorkflowEntry_changedAt_idx" ON "WorkflowEntry"("changedAt");

-- CreateIndex
CREATE INDEX "ModVersion_modId_idx" ON "ModVersion"("modId");

-- CreateIndex
CREATE INDEX "ModVersion_createdAt_idx" ON "ModVersion"("createdAt");

-- CreateIndex
CREATE INDEX "Endorsement_modId_idx" ON "Endorsement"("modId");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_userId_modId_key" ON "Endorsement"("userId", "modId");

-- CreateIndex
CREATE INDEX "ModFile_modId_idx" ON "ModFile"("modId");

-- CreateIndex
CREATE INDEX "ModFileLink_fileId_idx" ON "ModFileLink"("fileId");

-- CreateIndex
CREATE INDEX "ModFileLink_provider_idx" ON "ModFileLink"("provider");

-- CreateIndex
CREATE INDEX "ModVideoGroup_modId_idx" ON "ModVideoGroup"("modId");

-- CreateIndex
CREATE INDEX "ModVideo_groupId_idx" ON "ModVideo"("groupId");

-- CreateIndex
CREATE INDEX "ModTeamMember_modId_idx" ON "ModTeamMember"("modId");

-- CreateIndex
CREATE INDEX "ModContactLink_modId_idx" ON "ModContactLink"("modId");

-- CreateIndex
CREATE UNIQUE INDEX "ModCustomTab_modId_slug_key" ON "ModCustomTab"("modId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");

-- CreateIndex
CREATE INDEX "Series_name_idx" ON "Series"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "Team_isFeatured_idx" ON "Team"("isFeatured");

-- CreateIndex
CREATE INDEX "Team_order_idx" ON "Team"("order");

-- CreateIndex
CREATE INDEX "Team_modCount_idx" ON "Team"("modCount");

-- CreateIndex
CREATE INDEX "Team_views_idx" ON "Team"("views");

-- CreateIndex
CREATE INDEX "TeamFollow_teamId_idx" ON "TeamFollow"("teamId");

-- CreateIndex
CREATE INDEX "TeamFollow_userId_idx" ON "TeamFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamFollow_teamId_userId_key" ON "TeamFollow"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TeamMembership_userId_idx" ON "TeamMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_userId_key" ON "TeamMembership"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TeamContactLink_teamId_idx" ON "TeamContactLink"("teamId");

-- CreateIndex
CREATE INDEX "TeamCustomTab_teamId_idx" ON "TeamCustomTab"("teamId");

-- CreateIndex
CREATE INDEX "UserAction_userId_idx" ON "UserAction"("userId");

-- CreateIndex
CREATE INDEX "UserAction_byUserId_idx" ON "UserAction"("byUserId");

-- CreateIndex
CREATE INDEX "UserAction_createdAt_idx" ON "UserAction"("createdAt");

-- CreateIndex
CREATE INDEX "UserAction_action_idx" ON "UserAction"("action");

-- CreateIndex
CREATE INDEX "UserAction_userId_action_createdAt_idx" ON "UserAction"("userId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TierRule_tier_key" ON "TierRule"("tier");

-- CreateIndex
CREATE INDEX "TierHistory_userId_idx" ON "TierHistory"("userId");

-- CreateIndex
CREATE INDEX "TierHistory_createdAt_idx" ON "TierHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialRole_key_key" ON "SpecialRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");

-- CreateIndex
CREATE INDEX "News_type_visible_idx" ON "News"("type", "visible");

-- CreateIndex
CREATE INDEX "News_publishAt_idx" ON "News"("publishAt");

-- CreateIndex
CREATE INDEX "News_clicksCount_idx" ON "News"("clicksCount");

-- CreateIndex
CREATE INDEX "NewsView_newsId_idx" ON "NewsView"("newsId");

-- CreateIndex
CREATE INDEX "NewsView_viewedAt_idx" ON "NewsView"("viewedAt");

-- CreateIndex
CREATE INDEX "NewsView_userId_idx" ON "NewsView"("userId");

-- CreateIndex
CREATE INDEX "NewsClick_newsId_idx" ON "NewsClick"("newsId");

-- CreateIndex
CREATE INDEX "NewsClick_clickedAt_idx" ON "NewsClick"("clickedAt");

-- CreateIndex
CREATE INDEX "NewsClick_userId_idx" ON "NewsClick"("userId");

-- CreateIndex
CREATE INDEX "ModComment_modId_idx" ON "ModComment"("modId");

-- CreateIndex
CREATE INDEX "ModComment_userId_idx" ON "ModComment"("userId");

-- CreateIndex
CREATE INDEX "ModComment_parentId_idx" ON "ModComment"("parentId");

-- CreateIndex
CREATE INDEX "ModComment_createdAt_idx" ON "ModComment"("createdAt");

-- CreateIndex
CREATE INDEX "ModComment_modId_createdAt_idx" ON "ModComment"("modId", "createdAt");

-- CreateIndex
CREATE INDEX "ModComment_userId_createdAt_idx" ON "ModComment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModComment_modId_parentId_idx" ON "ModComment"("modId", "parentId");

-- CreateIndex
CREATE INDEX "ModComment_modId_isHidden_createdAt_idx" ON "ModComment"("modId", "isHidden", "createdAt");

-- CreateIndex
CREATE INDEX "ModRequest_status_idx" ON "ModRequest"("status");

-- CreateIndex
CREATE INDEX "ModRequest_userId_idx" ON "ModRequest"("userId");

-- CreateIndex
CREATE INDEX "ModRequest_acceptedBy_idx" ON "ModRequest"("acceptedBy");

-- CreateIndex
CREATE INDEX "ModRequest_gameName_idx" ON "ModRequest"("gameName");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");

-- CreateIndex
CREATE INDEX "HomepageAd_visible_idx" ON "HomepageAd"("visible");

-- CreateIndex
CREATE INDEX "HomepageAd_startDate_idx" ON "HomepageAd"("startDate");

-- CreateIndex
CREATE INDEX "HomepageAd_endDate_idx" ON "HomepageAd"("endDate");

-- CreateIndex
CREATE INDEX "HomepageAd_clicksCount_idx" ON "HomepageAd"("clicksCount");

-- CreateIndex
CREATE INDEX "AdClick_adId_idx" ON "AdClick"("adId");

-- CreateIndex
CREATE INDEX "AdClick_clickedAt_idx" ON "AdClick"("clickedAt");

-- CreateIndex
CREATE INDEX "AdClick_userId_idx" ON "AdClick"("userId");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_actor_id_idx" ON "notifications"("actor_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_type_created_at_idx" ON "notifications"("user_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_notification_id_idx" ON "notification_logs"("notification_id");

-- CreateIndex
CREATE INDEX "notification_jobs_status_scheduled_for_idx" ON "notification_jobs"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "notification_jobs_notification_id_idx" ON "notification_jobs"("notification_id");

-- CreateIndex
CREATE INDEX "notification_jobs_channel_idx" ON "notification_jobs"("channel");

-- CreateIndex
CREATE INDEX "notification_templates_isActive_idx" ON "notification_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_type_channel_key" ON "notification_templates"("type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "IpBan_ipAddress_key" ON "IpBan"("ipAddress");

-- CreateIndex
CREATE INDEX "IpBan_ipAddress_idx" ON "IpBan"("ipAddress");

-- CreateIndex
CREATE INDEX "IpBan_expiresAt_idx" ON "IpBan"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTrustScore_userId_key" ON "UserTrustScore"("userId");

-- CreateIndex
CREATE INDEX "UserTrustScore_userId_idx" ON "UserTrustScore"("userId");

-- CreateIndex
CREATE INDEX "UserTrustScore_score_idx" ON "UserTrustScore"("score");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_targetModId_idx" ON "Report"("targetModId");

-- CreateIndex
CREATE INDEX "Report_targetCommentId_idx" ON "Report"("targetCommentId");

-- CreateIndex
CREATE INDEX "Report_targetUserId_idx" ON "Report"("targetUserId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_priority_idx" ON "Report"("priority");

-- CreateIndex
CREATE INDEX "Report_reason_idx" ON "Report"("reason");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "Report_status_priority_idx" ON "Report"("status", "priority");

-- CreateIndex
CREATE INDEX "Report_reporterId_targetModId_createdAt_idx" ON "Report"("reporterId", "targetModId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_targetCommentId_createdAt_idx" ON "Report"("reporterId", "targetCommentId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reporterId_targetUserId_createdAt_idx" ON "Report"("reporterId", "targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportFraudSignal_reportId_idx" ON "ReportFraudSignal"("reportId");

-- CreateIndex
CREATE INDEX "ReportFraudSignal_signalType_idx" ON "ReportFraudSignal"("signalType");

-- CreateIndex
CREATE INDEX "ReportStatusHistory_reportId_idx" ON "ReportStatusHistory"("reportId");

-- CreateIndex
CREATE INDEX "ReportStatusHistory_createdAt_idx" ON "ReportStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_modId_idx" ON "Bookmark"("modId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_modId_key" ON "Bookmark"("userId", "modId");

-- CreateIndex
CREATE INDEX "CommentLike_userId_idx" ON "CommentLike"("userId");

-- CreateIndex
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_userId_commentId_key" ON "CommentLike"("userId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_slug_key" ON "Section"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Section_key_key" ON "Section"("key");

-- CreateIndex
CREATE INDEX "Section_isActive_order_idx" ON "Section"("isActive", "order");

-- CreateIndex
CREATE INDEX "DownloadClick_modId_idx" ON "DownloadClick"("modId");

-- CreateIndex
CREATE INDEX "DownloadClick_createdAt_idx" ON "DownloadClick"("createdAt");

-- CreateIndex
CREATE INDEX "DownloadClick_createdAt_modId_idx" ON "DownloadClick"("createdAt", "modId");

-- CreateIndex
CREATE INDEX "ModView_modId_idx" ON "ModView"("modId");

-- CreateIndex
CREATE INDEX "ModView_userId_idx" ON "ModView"("userId");

-- CreateIndex
CREATE INDEX "ModView_viewedAt_idx" ON "ModView"("viewedAt");

-- CreateIndex
CREATE INDEX "ModView_modId_viewedAt_idx" ON "ModView"("modId", "viewedAt");

-- CreateIndex
CREATE INDEX "ScheduledJob_status_idx" ON "ScheduledJob"("status");

-- CreateIndex
CREATE INDEX "ScheduledJob_scheduledAt_idx" ON "ScheduledJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledJob_type_idx" ON "ScheduledJob"("type");

-- CreateIndex
CREATE INDEX "ModRating_modId_idx" ON "ModRating"("modId");

-- CreateIndex
CREATE INDEX "ModRating_userId_idx" ON "ModRating"("userId");

-- CreateIndex
CREATE INDEX "ModRating_createdAt_idx" ON "ModRating"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModRating_modId_userId_key" ON "ModRating"("modId", "userId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "Ticket_category_idx" ON "Ticket"("category");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- CreateIndex
CREATE INDEX "Ticket_assignedTo_idx" ON "Ticket"("assignedTo");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "TicketMessage_userId_idx" ON "TicketMessage"("userId");

-- CreateIndex
CREATE INDEX "TicketMessage_createdAt_idx" ON "TicketMessage"("createdAt");

-- CreateIndex
CREATE INDEX "TicketTag_ticketId_idx" ON "TicketTag"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTag_ticketId_tag_key" ON "TicketTag"("ticketId", "tag");

-- CreateIndex
CREATE INDEX "TeamAchievement_teamId_idx" ON "TeamAchievement"("teamId");

-- CreateIndex
CREATE INDEX "TeamAchievement_achievementId_idx" ON "TeamAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAchievement_teamId_achievementId_key" ON "TeamAchievement"("teamId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPoints_teamId_key" ON "TeamPoints"("teamId");

-- CreateIndex
CREATE INDEX "PointsTransaction_teamId_idx" ON "PointsTransaction"("teamId");

-- CreateIndex
CREATE INDEX "PointsTransaction_createdAt_idx" ON "PointsTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE INDEX "SearchClick_query_idx" ON "SearchClick"("query");

-- CreateIndex
CREATE INDEX "SearchClick_createdAt_idx" ON "SearchClick"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformView_platform_idx" ON "PlatformView"("platform");

-- CreateIndex
CREATE INDEX "PlatformView_createdAt_idx" ON "PlatformView"("createdAt");

-- CreateIndex
CREATE INDEX "UTMTracking_source_idx" ON "UTMTracking"("source");

-- CreateIndex
CREATE INDEX "UTMTracking_createdAt_idx" ON "UTMTracking"("createdAt");

-- CreateIndex
CREATE INDEX "BrokenImage_modId_idx" ON "BrokenImage"("modId");

-- CreateIndex
CREATE INDEX "BrokenImage_status_idx" ON "BrokenImage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BrokenImage_modId_imageUrl_key" ON "BrokenImage"("modId", "imageUrl");

-- CreateIndex
CREATE INDEX "ImageHealthLog_platform_week_idx" ON "ImageHealthLog"("platform", "week");

-- CreateIndex
CREATE INDEX "ImageHealthLog_createdAt_idx" ON "ImageHealthLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "UploadAsset_userId_idx" ON "UploadAsset"("userId");

-- CreateIndex
CREATE INDEX "UploadAsset_modId_idx" ON "UploadAsset"("modId");

-- CreateIndex
CREATE INDEX "UploadAsset_provider_idx" ON "UploadAsset"("provider");

-- CreateIndex
CREATE INDEX "UploadAsset_createdAt_idx" ON "UploadAsset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaPolicy_rank_key" ON "QuotaPolicy"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaOverride_userId_key" ON "QuotaOverride"("userId");

-- CreateIndex
CREATE INDEX "QuotaOverride_userId_idx" ON "QuotaOverride"("userId");

-- CreateIndex
CREATE INDEX "UploadUsageDaily_date_idx" ON "UploadUsageDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UploadUsageDaily_userId_date_key" ON "UploadUsageDaily"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorStorage_userId_key" ON "CreatorStorage"("userId");

-- CreateIndex
CREATE INDEX "CreatorStorage_userId_idx" ON "CreatorStorage"("userId");

-- AddForeignKey
ALTER TABLE "CreatorRequest" ADD CONSTRAINT "CreatorRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mod" ADD CONSTRAINT "Mod_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Mod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEntry" ADD CONSTRAINT "WorkflowEntry_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEntry" ADD CONSTRAINT "WorkflowEntry_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModVersion" ADD CONSTRAINT "ModVersion_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModVersion" ADD CONSTRAINT "ModVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModFile" ADD CONSTRAINT "ModFile_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModFile" ADD CONSTRAINT "ModFile_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ModVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModFileLink" ADD CONSTRAINT "ModFileLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ModFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModVideoGroup" ADD CONSTRAINT "ModVideoGroup_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModVideo" ADD CONSTRAINT "ModVideo_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModVideoGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModTeamMember" ADD CONSTRAINT "ModTeamMember_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModContactLink" ADD CONSTRAINT "ModContactLink_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModCustomTab" ADD CONSTRAINT "ModCustomTab_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamFollow" ADD CONSTRAINT "TeamFollow_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamFollow" ADD CONSTRAINT "TeamFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamContactLink" ADD CONSTRAINT "TeamContactLink_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCustomTab" ADD CONSTRAINT "TeamCustomTab_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierHistory" ADD CONSTRAINT "TierHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsView" ADD CONSTRAINT "NewsView_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsView" ADD CONSTRAINT "NewsView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsClick" ADD CONSTRAINT "NewsClick_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsClick" ADD CONSTRAINT "NewsClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModComment" ADD CONSTRAINT "ModComment_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModComment" ADD CONSTRAINT "ModComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModComment" ADD CONSTRAINT "ModComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ModComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModRequest" ADD CONSTRAINT "ModRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModRequest" ADD CONSTRAINT "ModRequest_acceptedBy_fkey" FOREIGN KEY ("acceptedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModRequest" ADD CONSTRAINT "ModRequest_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_adId_fkey" FOREIGN KEY ("adId") REFERENCES "HomepageAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrustScore" ADD CONSTRAINT "UserTrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetModId_fkey" FOREIGN KEY ("targetModId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetCommentId_fkey" FOREIGN KEY ("targetCommentId") REFERENCES "ModComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFraudSignal" ADD CONSTRAINT "ReportFraudSignal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportStatusHistory" ADD CONSTRAINT "ReportStatusHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportStatusHistory" ADD CONSTRAINT "ReportStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ModComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadClick" ADD CONSTRAINT "DownloadClick_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModView" ADD CONSTRAINT "ModView_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModView" ADD CONSTRAINT "ModView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModRating" ADD CONSTRAINT "ModRating_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModRating" ADD CONSTRAINT "ModRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTag" ADD CONSTRAINT "TicketTag_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAchievement" ADD CONSTRAINT "TeamAchievement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAchievement" ADD CONSTRAINT "TeamAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPoints" ADD CONSTRAINT "TeamPoints_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokenImage" ADD CONSTRAINT "BrokenImage_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

