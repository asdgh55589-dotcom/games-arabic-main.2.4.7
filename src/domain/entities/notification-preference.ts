/**
 * NotificationPreference Entity — تفضيلات الإشعار
 * Immutable domain entity. All methods return NEW instances.
 * No external dependencies — pure TypeScript only.
 */

import { NotificationChannel, type NotificationType } from '../value-objects'

/** Per-type preference override */
export interface TypePreference {
  enabled: boolean
  emailEnabled?: boolean
  pushEnabled?: boolean
}

/** Props for creating default preferences */
export interface CreateDefaultPreferenceProps {
  userId: string
}

/** Props for reconstructing from database */
export interface ReconstructPreferenceProps {
  id: string
  userId: string
  emailEnabled: boolean
  pushEnabled: boolean
  dailySummary: boolean
  summaryIntervalDays: number
  likeThreshold: number
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  typePreferences: Record<string, TypePreference>
  createdAt: Date
  updatedAt: Date
}

/** Props for partial updates */
export interface PreferenceUpdate {
  emailEnabled: boolean
  pushEnabled: boolean
  dailySummary: boolean
  summaryIntervalDays: number
  likeThreshold: number
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  typePreferences: Record<string, TypePreference>
}

export class NotificationPreference {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly emailEnabled: boolean,
    readonly pushEnabled: boolean,
    readonly dailySummary: boolean,
    readonly summaryIntervalDays: number,
    readonly likeThreshold: number,
    readonly quietHoursEnabled: boolean,
    readonly quietHoursStart: string | null,
    readonly quietHoursEnd: string | null,
    readonly typePreferences: Record<string, TypePreference>,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  /**
   * Create default preferences for a new user.
   */
  static createDefault(userId: string): NotificationPreference {
    if (!userId) throw new Error('NotificationPreference.userId is required')

    const now = new Date()
    return new NotificationPreference(
      generateId(),
      userId,
      true, // emailEnabled
      true, // pushEnabled
      true, // dailySummary
      3, // summaryIntervalDays
      25, // likeThreshold
      false, // quietHoursEnabled
      null, // quietHoursStart
      null, // quietHoursEnd
      {}, // typePreferences
      now,
      now,
    )
  }

  /**
   * Reconstruct from database — no validation.
   */
  static reconstruct(props: ReconstructPreferenceProps): NotificationPreference {
    return new NotificationPreference(
      props.id,
      props.userId,
      props.emailEnabled,
      props.pushEnabled,
      props.dailySummary,
      props.summaryIntervalDays,
      props.likeThreshold,
      props.quietHoursEnabled,
      props.quietHoursStart,
      props.quietHoursEnd,
      props.typePreferences,
      props.createdAt,
      props.updatedAt,
    )
  }

  /**
   * Check if a notification of given type and channel can be delivered.
   * Checks channel-level switch, type-level preference, and quiet hours.
   */
  canDeliver(type: NotificationType, channel: NotificationChannel, date?: Date): boolean {
    // 1. Channel-level switch
    if (channel === NotificationChannel.Email && !this.emailEnabled) return false
    if (channel === NotificationChannel.InApp && !this.pushEnabled) return false

    // 2. Type-level preference
    const typePref = this.typePreferences[type]
    if (typePref) {
      if (!typePref.enabled) return false
      if (channel === NotificationChannel.Email && typePref.emailEnabled === false) return false
      if (channel === NotificationChannel.InApp && typePref.pushEnabled === false) return false
    }

    // 3. Quiet hours (only affects push/in-app, not email)
    if (channel === NotificationChannel.InApp && this.quietHoursEnabled) {
      const checkDate = date ?? new Date()
      if (this.isInQuietHours(checkDate)) return false
    }

    return true
  }

  /**
   * Check if the given date falls within quiet hours.
   * Handles overnight ranges (e.g., 23:00 - 07:00).
   */
  isInQuietHours(date: Date): boolean {
    if (!this.quietHoursEnabled) return false
    if (!this.quietHoursStart || !this.quietHoursEnd) return false

    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    const start = this.quietHoursStart
    const end = this.quietHoursEnd

    if (start <= end) {
      // Same-day range (e.g., 08:00 - 22:00)
      return timeStr >= start && timeStr <= end
    } else {
      // Overnight range (e.g., 23:00 - 07:00)
      return timeStr >= start || timeStr <= end
    }
  }

  /**
   * Update preferences — returns a NEW instance.
   */
  updatePreference(partial: Partial<PreferenceUpdate>): NotificationPreference {
    return new NotificationPreference(
      this.id,
      this.userId,
      partial.emailEnabled ?? this.emailEnabled,
      partial.pushEnabled ?? this.pushEnabled,
      partial.dailySummary ?? this.dailySummary,
      partial.summaryIntervalDays ?? this.summaryIntervalDays,
      partial.likeThreshold ?? this.likeThreshold,
      partial.quietHoursEnabled ?? this.quietHoursEnabled,
      partial.quietHoursStart !== undefined ? partial.quietHoursStart : this.quietHoursStart,
      partial.quietHoursEnd !== undefined ? partial.quietHoursEnd : this.quietHoursEnd,
      partial.typePreferences ?? this.typePreferences,
      this.createdAt,
      new Date(),
    )
  }
}

/** Generate a cuid-like ID */
function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}${random}`
}
