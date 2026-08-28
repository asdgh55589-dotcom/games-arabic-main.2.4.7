/**
 * NotificationType — أنواع الإشعارات
 * Pure value object with no external dependencies.
 */

export enum NotificationType {
  // Social
  CommentReply = 'comment_reply',
  TopLevelComment = 'top_level_comment',
  Like = 'like',
  Follow = 'follow',

  // Mods
  ModEndorse = 'mod_endorse',
  ModEndorseMilestone = 'mod_endorse_milestone',
  ModFeatured = 'mod_featured',
  ModPublished = 'mod_published',
  ModUpdated = 'mod_updated',
  ModDeleted = 'mod_deleted',

  // Tiers & Roles
  TierUpgrade = 'tier_upgrade',
  TierRevoked = 'tier_revoked',
  SpecialRoleAssigned = 'special_role_assigned',
  SpecialRoleRemoved = 'special_role_removed',

  // Admin
  AdminAction = 'admin_action',
  AdminUserRegister = 'admin_user_register',
  AdminRequest = 'admin_request',
  AdminReport = 'admin_report',
  AdminMilestone = 'admin_milestone',

  // System
  SystemAnnouncement = 'system_announcement',
}

/** Arabic labels for display */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.CommentReply]: 'رد على تعليق',
  [NotificationType.TopLevelComment]: 'تعليق جديد',
  [NotificationType.Like]: 'إعجاب',
  [NotificationType.Follow]: 'متابعة جديدة',
  [NotificationType.ModEndorse]: 'تصويت على تعريب',
  [NotificationType.ModEndorseMilestone]: 'إنجاز تصويت',
  [NotificationType.ModFeatured]: 'تعريب مميز',
  [NotificationType.ModPublished]: 'تعريب جديد',
  [NotificationType.ModUpdated]: 'تحديث تعريب',
  [NotificationType.ModDeleted]: 'حذف تعريب',
  [NotificationType.TierUpgrade]: 'ترقية مستوى',
  [NotificationType.TierRevoked]: 'سحب مستوى',
  [NotificationType.SpecialRoleAssigned]: 'منح دور خاص',
  [NotificationType.SpecialRoleRemoved]: 'سحب دور خاص',
  [NotificationType.AdminAction]: 'إجراء إداري',
  [NotificationType.AdminUserRegister]: 'تسجيل مستخدم',
  [NotificationType.AdminRequest]: 'طلب مستخدم',
  [NotificationType.AdminReport]: 'بلاغ',
  [NotificationType.AdminMilestone]: 'إنجاز إداري',
  [NotificationType.SystemAnnouncement]: 'إعلان النظام',
}

/** Types that support email channel */
export const EMAILABLE_TYPES: ReadonlySet<NotificationType> = new Set([
  NotificationType.CommentReply,
  NotificationType.TopLevelComment,
  NotificationType.ModEndorseMilestone,
  NotificationType.ModFeatured,
  NotificationType.TierUpgrade,
  NotificationType.TierRevoked,
  NotificationType.SpecialRoleAssigned,
  NotificationType.SpecialRoleRemoved,
  NotificationType.AdminAction,
  NotificationType.SystemAnnouncement,
])
