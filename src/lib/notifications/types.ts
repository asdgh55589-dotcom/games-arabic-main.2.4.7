/**
 * lib/notifications/types.ts — أنواع الإشعارات المتعددة القنوات
 */

export enum NotificationType {
  CommentReply = 'comment_reply',
  Like = 'like',
  ModEndorse = 'mod_endorse',
  ModEndorseMilestone = 'mod_endorse_milestone',
  ModFeatured = 'mod_featured',
  TierUpgrade = 'tier_upgrade',
  SpecialRoleAssigned = 'special_role_assigned',
  SpecialRoleRemoved = 'special_role_removed',
  AdminAction = 'admin_action',
  AdminUserRegister = 'admin_user_register',
  AdminRequest = 'admin_request',
  AdminReport = 'admin_report',
  AdminMilestone = 'admin_milestone',
  // New types for Phase 6
  ModSubmitted = 'mod_submitted',
  ModApproved = 'mod_approved',
  ModRejected = 'mod_rejected',
  ModPublished = 'mod_published',
  ModScheduled = 'mod_scheduled',
  NewComment = 'new_comment',
  NewReport = 'new_report',
  NewVersion = 'new_version',
  BackupCompleted = 'backup_completed',
  SystemAlert = 'system_alert',
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.CommentReply]: 'رد على تعليق',
  [NotificationType.Like]: 'إعجاب',
  [NotificationType.ModEndorse]: 'تصويت على تعريب',
  [NotificationType.ModEndorseMilestone]: 'إنجاز تصويت',
  [NotificationType.ModFeatured]: 'تعريب مميز',
  [NotificationType.TierUpgrade]: 'ترقية مستوى',
  [NotificationType.SpecialRoleAssigned]: 'دور مخصص',
  [NotificationType.SpecialRoleRemoved]: 'إزالة دور',
  [NotificationType.AdminAction]: 'إجراء إداري',
  [NotificationType.AdminUserRegister]: 'تسجيل مستخدم',
  [NotificationType.AdminRequest]: 'طلب مستخدم',
  [NotificationType.AdminReport]: 'بلاغ',
  [NotificationType.AdminMilestone]: 'إنجاز إداري',
  [NotificationType.ModSubmitted]: 'تعريب مقدم',
  [NotificationType.ModApproved]: 'تعريب معتمد',
  [NotificationType.ModRejected]: 'تعريب مرفوض',
  [NotificationType.ModPublished]: 'تعريب منشور',
  [NotificationType.ModScheduled]: 'تعريب مجدول',
  [NotificationType.NewComment]: 'تعليق جديد',
  [NotificationType.NewReport]: 'بلاغ جديد',
  [NotificationType.NewVersion]: 'إصدار جديد',
  [NotificationType.BackupCompleted]: 'نسخ احتياطي مكتمل',
  [NotificationType.SystemAlert]: 'تنبيه النظام',
}

export type NotificationChannel = 'in_app' | 'email' | 'telegram'

export interface NotificationRecipient {
  userId: string
  channels: NotificationChannel[]
}

export interface NotificationEvent {
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  recipients: NotificationRecipient[]
  actorId?: string
  // Interactive target
  targetType?: 'mod' | 'profile' | 'team' | 'comment' | 'news'
  targetId?: string
  targetSlug?: string
  targetTitle?: string
  targetUrl?: string
  // Actor info
  actorUsername?: string
  actorAvatarUrl?: string
}
