/**
 * DeduplicationPolicy — سياسة منع التكرار
 * Prevents duplicate notifications within a configurable time window.
 */

import type { Notification } from '../entities'
import type { NotificationRepository } from '../ports'
import { NotificationType } from '../value-objects'

export interface DeduplicationResult {
  action: 'create' | 'skip'
  existingNotification?: Notification
  reason?: string
}

export interface DeduplicationConfig {
  /** Time window in minutes for each notification type */
  windowMinutes: Record<NotificationType, number>
}

/** Default configuration — most types don't deduplicate */
export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  windowMinutes: {
    [NotificationType.CommentReply]: 5,
    [NotificationType.TopLevelComment]: 0,
    [NotificationType.Like]: 10,
    [NotificationType.Follow]: 60,
    [NotificationType.ModEndorse]: 10,
    [NotificationType.ModEndorseMilestone]: 0,
    [NotificationType.ModFeatured]: 0,
    [NotificationType.ModPublished]: 0,
    [NotificationType.ModUpdated]: 0,
    [NotificationType.ModDeleted]: 0,
    [NotificationType.TierUpgrade]: 0,
    [NotificationType.TierRevoked]: 0,
    [NotificationType.SpecialRoleAssigned]: 0,
    [NotificationType.SpecialRoleRemoved]: 0,
    [NotificationType.AdminAction]: 60,
    [NotificationType.AdminUserRegister]: 0,
    [NotificationType.AdminRequest]: 0,
    [NotificationType.AdminReport]: 30,
    [NotificationType.AdminMilestone]: 0,
    [NotificationType.SystemAnnouncement]: 0,
    // مرحلة 6 — أدوات النشر:
    // فشل النشر: على الأقل 30 دقيقة بين إشعاري فشل (السماح بالإعادة عبر
    // المركز). النجاح الخفيف: بلا تكرار (0). تدهور الكيان: 60 دقيقة (نبضة
    // واحدة سيقها per-streak notifiedAt). التقرير الدوري: بلا تكرار (0).
    [NotificationType.SocialPublishFailed]: 30,
    [NotificationType.SocialPublishSucceeded]: 0,
    [NotificationType.PublishDegraded]: 60,
    [NotificationType.PublishDigest]: 0,
  },
}

export class DeduplicationPolicy {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly config: DeduplicationConfig = DEFAULT_DEDUPLICATION_CONFIG,
  ) {}

  /**
   * Check if a notification should be created or skipped.
   * Returns 'skip' if a similar notification exists within the time window.
   */
  async check(notification: Notification): Promise<DeduplicationResult> {
    const windowMinutes = this.config.windowMinutes[notification.type]

    // Window of 0 means no deduplication
    if (windowMinutes === 0) {
      return { action: 'create' }
    }

    const existing = await this.repository.findRecent(
      notification.userId,
      notification.type,
      windowMinutes,
    )

    if (existing) {
      return {
        action: 'skip',
        existingNotification: existing,
        reason: `Similar notification (${notification.type}) created within ${windowMinutes} minutes`,
      }
    }

    return { action: 'create' }
  }
}
