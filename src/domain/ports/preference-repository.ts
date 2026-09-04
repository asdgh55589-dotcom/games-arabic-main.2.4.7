/**
 * PreferenceRepository — منفذ مستودع تفضيلات الإشعار
 * Interface only — implementation provided by infrastructure layer.
 */

import type { NotificationPreference } from '../entities'

export interface PreferenceRepository {
  /** Find preferences for a user */
  findByUserId(userId: string): Promise<NotificationPreference | null>

  /** Create or update preferences */
  upsert(preference: NotificationPreference): Promise<NotificationPreference>
}
