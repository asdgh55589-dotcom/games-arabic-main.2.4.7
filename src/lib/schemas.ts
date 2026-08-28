/**
 * Shared Zod Validation Schemas
 *
 * Centralized validation schemas for all API endpoints.
 * Usage:
 *   const parsed = CreateModSchema.safeParse(body)
 *   if (!parsed.success) return validationFail(parsed.error.flatten())
 */

import { z } from 'zod'
import { isAllowedDownloadUrl } from '@/lib/constants'

// ===== Common Schemas =====

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

export const SlugParamSchema = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/)
export const UsernameParamSchema = z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/)

// ===== Auth Schemas =====

export const LoginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب').max(100).trim(),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(200),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
})

// ===== Mod Schemas =====

export const CreateModSchema = z.object({
  name: z.string().min(1).max(200),
  summary: z.string().min(1).max(500),
  description: z.string().min(1),
  gameId: z.string().min(1),
  categoryId: z.string().optional(),
  thumbnailUrl: z.string().url(),
  imageUrl: z.string().url(),
  version: z.string().default('1.0.0'),
  fileSize: z.string().default('MB 0'),
  fileFormat: z.string().default('zip'),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  series: z.string().optional(),
  translationTeam: z.string().optional(),
  translationType: z.enum(['official', 'unofficial']).default('unofficial'),
  isOriginalWork: z.boolean().default(true),
  originalSource: z.string().optional(),
  originalAuthor: z.string().optional(),
  sectionId: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isLatest: z.boolean().optional(),
  releaseDate: z.string().optional(),
  slug: z.string().optional(),
  changelog: z.string().optional(),
  installGuide: z.string().optional(),
  arabicTitle: z.string().optional(),
  translationScope: z.string().optional(),
  compatibility: z.string().optional(),
  galleryUrls: z.union([z.string(), z.array(z.string())]).optional(),
  seriesId: z.string().optional(),
  teamId: z.string().optional(),
  files: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    alert: z.string().optional(),
    version: z.string().optional(),
    releaseDate: z.string().optional(),
    fileSize: z.string().optional(),
    fileFormat: z.string().optional(),
    order: z.number().optional(),
    links: z.array(z.object({
      url: z.string().url().refine(
        (url) => isAllowedDownloadUrl(url),
        { message: 'رابط التحميل يجب أن يكون من موقع مسموح (Google Drive, Mega, Mediafire, etc.)' }
      ),
      label: z.string().optional(),
    })).optional(),
  })).optional(),
  teamMembers: z.array(z.object({
    name: z.string().min(1),
    avatarUrl: z.string().optional(),
    role: z.string().optional(),
    contribution: z.string().optional(),
    order: z.number().optional(),
  })).optional(),
  contactLinks: z.array(z.object({
    type: z.string().optional(),
    label: z.string().optional(),
    url: z.string().url(),
    order: z.number().optional(),
  })).optional(),
  videoGroups: z.array(z.object({
    name: z.string().min(1),
    order: z.number().optional(),
    videos: z.array(z.object({
      title: z.string().min(1),
      url: z.string().url(),
      thumbnail: z.string().optional(),
      duration: z.string().optional(),
      description: z.string().optional(),
      views: z.number().optional(),
      likes: z.number().optional(),
      commentsCount: z.number().optional(),
      channel: z.string().optional(),
      order: z.number().optional(),
    })).optional(),
  })).optional(),
  customTabs: z.array(z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    content: z.string().optional(),
    order: z.number().optional(),
    visible: z.boolean().optional(),
  })).optional(),
})

export const UpdateModSchema = CreateModSchema.partial()

// ===== User/Profile Schemas =====

export const UpdateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  accentColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i).optional(),
  profileVisibility: z.enum(['everyone', 'followers', 'nobody']).optional(),
  socialLinks: z.object({
    website: z.string().url().nullable().optional(),
    twitter: z.string().max(50).nullable().optional(),
    youtube: z.string().url().nullable().optional(),
    discord: z.string().max(50).nullable().optional(),
    telegram: z.string().max(50).nullable().optional(),
  }).optional(),
  displayName: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
})

export const CreateUserSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  role: z.enum(['member', 'creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']).default('member'),
})

// ===== Comment Schemas =====

export const CreateCommentSchema = z.object({
  text: z.string().min(1).max(2000).trim(),
  guestName: z.string().min(1).max(50).optional(),
  parentId: z.string().optional(),
})

export const UpdateCommentSchema = z.object({
  text: z.string().min(1).max(2000).trim(),
})

// ===== Bookmark Schema =====

export const BookmarkSchema = z.object({
  modId: z.string().min(1),
})

// ===== Report Schema =====

export const CreateReportSchema = z.object({
  targetType: z.enum(['mod', 'comment', 'user']),
  targetModId: z.string().optional(),
  targetCommentId: z.string().optional(),
  targetUserId: z.string().optional(),
  reason: z.enum(['spam', 'inappropriate', 'copyright', 'offensive', 'false_info', 'technical', 'other']),
  details: z.string().max(2000).optional(),
})

// ===== Notification Schema =====

export const NotificationTypeSchema = z.enum([
  'comment_reply',
  'top_level_comment',
  'like',
  'follow',
  'mod_endorse',
  'mod_endorse_milestone',
  'mod_featured',
  'mod_published',
  'mod_updated',
  'mod_deleted',
  'tier_upgrade',
  'tier_revoked',
  'special_role_assigned',
  'special_role_removed',
  'admin_action',
  'admin_user_register',
  'admin_request',
  'admin_report',
  'admin_milestone',
  'system_announcement',
])

export const NotificationChannelSchema = z.enum(['in_app', 'email', 'telegram'])

export const CreateTemplateSchema = z.object({
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  titleTemplate: z.string().min(1, 'عنوان القالب مطلوب'),
  bodyTemplate: z.string().min(1, 'محتوى القالب مطلوب'),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

export const UpdateTemplateSchema = CreateTemplateSchema.partial()

// ===== Notification Preferences Schema =====

export const UpdatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
  summaryIntervalDays: z.number().int().min(1).max(30).optional(),
  likeThreshold: z.number().int().min(5).max(100).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  typePreferences: z.record(z.string(), z.object({
    enabled: z.boolean(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
  })).optional(),
}).refine(data => {
  if (data.quietHoursEnabled) {
    return data.quietHoursStart != null && data.quietHoursEnd != null
  }
  return true
}, {
  message: 'يجب تحديد وقت البداية والنهاية لساعات الهدوء',
})

// ===== Game Schemas =====

export const CreateGameSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  tagline: z.string().max(500).optional(),
  description: z.string().optional(),
  category: z.string().min(1),
  platform: z.string().min(1),
  releaseYear: z.number().int().min(1970).max(2100),
  thumbnailUrl: z.string().url(),
  bannerUrl: z.string().url().optional(),
  logoUrl: z.string().url().nullable().optional(),
  featured: z.boolean().optional(),
})

export const UpdateGameSchema = CreateGameSchema.partial()

// ===== Team Schemas =====

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  discordUrl: z.string().url().optional(),
  telegramUrl: z.string().url().optional(),
  isOfficial: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
})

export const UpdateTeamSchema = CreateTeamSchema.partial()

// ===== Series Schemas =====

export const CreateSeriesSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
  description: z.string().optional(),
  bannerUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  color: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isOfficial: z.boolean().optional(),
  order: z.number().int().optional(),
})

export const UpdateSeriesSchema = CreateSeriesSchema.partial()

// ===== News Schemas =====

export const CreateNewsSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  summary: z.string().min(1).max(500),
  content: z.string().optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  category: z.enum(['general', 'update', 'announcement', 'event']).default('general'),
  type: z.enum(['ticker', 'featured']).default('ticker'),
  isSticky: z.boolean().optional(),
  visible: z.boolean().optional(),
  publishAt: z.string().optional(),
  expiresAt: z.string().optional(),
})

export const UpdateNewsSchema = CreateNewsSchema.partial()

// ===== Ad Schemas =====

export const CreateAdSchema = z.object({
  type: z.enum(['youtube', 'image', 'html']),
  url: z.string().url().optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  link: z.string().url().optional(),
  size: z.enum(['small', 'medium', 'large', 'full']).default('medium'),
  order: z.number().int().optional(),
  visible: z.boolean().optional(),
})

export const UpdateAdSchema = CreateAdSchema.partial()

// ===== Settings Schema =====

export const UpdateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  group: z.enum(['general', 'appearance', 'seo', 'social']).default('general'),
})

// ===== Ban/Unban Schema =====

export const BanUserSchema = z.object({
  reason: z.string().min(1).max(500),
  duration: z.number().int().min(1).max(365).optional(), // days, null = permanent
})

// ===== Tier Rule Schema =====

export const TierRuleSchema = z.object({
  tier: z.number().int().min(0).max(5),
  name: z.string().min(1).max(50),
  nameEn: z.string().min(1).max(50),
  requiredMods: z.number().int().min(0),
  requiredDownloads: z.number().int().min(0),
  requiredRating: z.number().min(0).max(5),
  requiredQualityScore: z.number().int().min(0).max(100),
  badge: z.string().optional(),
  badgeColor: z.string().optional(),
  features: z.array(z.string()).optional(),
})
