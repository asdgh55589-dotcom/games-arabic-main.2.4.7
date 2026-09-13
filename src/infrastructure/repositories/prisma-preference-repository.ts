/**
 * PrismaPreferenceRepository — مستودع تفضيلات الإشعار via Prisma
 * Maps between domain entity and Prisma schema including quietHours and typePreferences.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import type { TypePreference } from '@/domain'
import { NotificationPreference, type PreferenceRepository } from '@/domain'

export class PrismaPreferenceRepository implements PreferenceRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const record = await this.db.notificationPreference.findUnique({
      where: { userId },
    })
    if (!record) return null
    return NotificationPreference.reconstruct({
      id: record.id,
      userId: record.userId,
      emailEnabled: record.emailEnabled,
      pushEnabled: record.pushEnabled,
      dailySummary: record.dailySummary,
      summaryIntervalDays: record.summaryIntervalDays,
      likeThreshold: record.likeThreshold,
      quietHoursEnabled: record.quietHoursEnabled,
      quietHoursStart: record.quietHoursStart,
      quietHoursEnd: record.quietHoursEnd,
      typePreferences: parseTypePreferences(record.typePreferences),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  }

  async upsert(preference: NotificationPreference): Promise<NotificationPreference> {
    const record = await this.db.notificationPreference.upsert({
      where: { userId: preference.userId },
      create: {
        userId: preference.userId,
        emailEnabled: preference.emailEnabled,
        pushEnabled: preference.pushEnabled,
        dailySummary: preference.dailySummary,
        summaryIntervalDays: preference.summaryIntervalDays,
        likeThreshold: preference.likeThreshold,
        quietHoursEnabled: preference.quietHoursEnabled,
        quietHoursStart: preference.quietHoursStart,
        quietHoursEnd: preference.quietHoursEnd,
        typePreferences: preference.typePreferences as unknown as Prisma.InputJsonValue,
      },
      update: {
        emailEnabled: preference.emailEnabled,
        pushEnabled: preference.pushEnabled,
        dailySummary: preference.dailySummary,
        summaryIntervalDays: preference.summaryIntervalDays,
        likeThreshold: preference.likeThreshold,
        quietHoursEnabled: preference.quietHoursEnabled,
        quietHoursStart: preference.quietHoursStart,
        quietHoursEnd: preference.quietHoursEnd,
        typePreferences: preference.typePreferences as unknown as Prisma.InputJsonValue,
      },
    })
    return NotificationPreference.reconstruct({
      id: record.id,
      userId: record.userId,
      emailEnabled: record.emailEnabled,
      pushEnabled: record.pushEnabled,
      dailySummary: record.dailySummary,
      summaryIntervalDays: record.summaryIntervalDays,
      likeThreshold: record.likeThreshold,
      quietHoursEnabled: record.quietHoursEnabled,
      quietHoursStart: record.quietHoursStart,
      quietHoursEnd: record.quietHoursEnd,
      typePreferences: parseTypePreferences(record.typePreferences),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  }
}

/** Safely parse JSON typePreferences from DB (handles string, object, or null) */
function parseTypePreferences(raw: unknown): Record<string, TypePreference> {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, TypePreference>
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort preference repository
    }
  }
  return {}
}
