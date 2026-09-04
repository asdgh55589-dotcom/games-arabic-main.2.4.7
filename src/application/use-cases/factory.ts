/**
 * Use Case Factory — مصنع حالات الاستخدام
 * Creates all notification use cases with proper dependency injection.
 */

import { getNotificationService } from '@/infrastructure/di/notification-container'
import { SendAdminAlertNotification } from './admin/send-admin-alert'
import { SendSystemAnnouncementNotification } from './admin/send-system-announcement'
import { SendModDeletedNotification } from './mods/send-mod-deleted'
import { SendModFeaturedNotification } from './mods/send-mod-featured'
import { SendModPublishedNotification } from './mods/send-mod-published'
import { SendModUpdatedNotification } from './mods/send-mod-updated'
import { SendAutoBanNotification } from './reports/send-auto-ban'
import { SendAutoWarningNotification } from './reports/send-auto-warning'
import { SendReportConfirmedNotification } from './reports/send-report-confirmed'
import { SendReportRejectedNotification } from './reports/send-report-rejected'
import { SendReportSubmittedNotification } from './reports/send-report-submitted'
import { SendCommentReplyNotification } from './social/send-comment-reply'
import { SendEndorseMilestoneNotification } from './social/send-endorse-milestone'
import { SendFollowNotification } from './social/send-follow'
import { SendLikeNotification } from './social/send-like'
import { SendTopLevelCommentNotification } from './social/send-top-level-comment'
import { SendSpecialRoleAssignedNotification } from './tiers-roles/send-special-role-assigned'
import { SendSpecialRoleRemovedNotification } from './tiers-roles/send-special-role-removed'
import { SendTierRevokedNotification } from './tiers-roles/send-tier-revoked'
import { SendTierUpgradeNotification } from './tiers-roles/send-tier-upgrade'

let useCases: ReturnType<typeof createUseCases> | null = null

function createUseCases() {
  const service = getNotificationService()

  return {
    sendCommentReply: new SendCommentReplyNotification(service),
    sendTopLevelComment: new SendTopLevelCommentNotification(service),
    sendLike: new SendLikeNotification(service),
    sendFollow: new SendFollowNotification(service),
    sendEndorseMilestone: new SendEndorseMilestoneNotification(service),
    sendModPublished: new SendModPublishedNotification(service),
    sendModUpdated: new SendModUpdatedNotification(service),
    sendModDeleted: new SendModDeletedNotification(service),
    sendModFeatured: new SendModFeaturedNotification(service),
    sendTierUpgrade: new SendTierUpgradeNotification(service),
    sendTierRevoked: new SendTierRevokedNotification(service),
    sendSpecialRoleAssigned: new SendSpecialRoleAssignedNotification(service),
    sendSpecialRoleRemoved: new SendSpecialRoleRemovedNotification(service),
    sendReportSubmitted: new SendReportSubmittedNotification(service),
    sendReportConfirmed: new SendReportConfirmedNotification(service),
    sendReportRejected: new SendReportRejectedNotification(service),
    sendAutoWarning: new SendAutoWarningNotification(service),
    sendAutoBan: new SendAutoBanNotification(service),
    sendAdminAlert: new SendAdminAlertNotification(service),
    sendSystemAnnouncement: new SendSystemAnnouncementNotification(service),
  }
}

export function getUseCases() {
  if (!useCases) {
    useCases = createUseCases()
  }
  return useCases
}
