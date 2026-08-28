/**
 * PreferencePolicy — سياسة التفضيلات
 * Checks user preferences before delivering notifications.
 */

import { NotificationType, NotificationChannel } from '../value-objects'
import { PreferenceRepository } from '../ports'

export class PreferencePolicy {
  constructor(private readonly preferenceRepository: PreferenceRepository) {}

  /**
   * Check if a notification can be delivered to the user on the given channel.
   */
  async canDeliver(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preference = await this.preferenceRepository.findByUserId(userId)

    // No preferences found — use defaults (allow all)
    if (!preference) return true

    return preference.canDeliver(type, channel)
  }

  /**
   * Check if delivery should be delayed (quiet hours).
   * Only affects push/in-app channel.
   */
  async shouldQueueForLater(userId: string, date: Date): Promise<boolean> {
    const preference = await this.preferenceRepository.findByUserId(userId)

    if (!preference) return false
    if (!preference.quietHoursEnabled) return false

    return preference.isInQuietHours(date)
  }
}
