import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { ok, unauthorized, validationFail, internalError } from '@/lib/api-response'
import { UpdatePreferencesSchema } from '@/lib/schemas'

const DEFAULT_PREFERENCES = {
  emailEnabled: true,
  pushEnabled: true,
  dailySummary: true,
  summaryIntervalDays: 3,
  likeThreshold: 25,
  quietHoursEnabled: false,
  quietHoursStart: null as string | null,
  quietHoursEnd: null as string | null,
  typePreferences: {},
}

// GET /api/notifications/preferences — جلب تفضيلات الإشعارات
export async function GET() {
  try {
    const user = await requireAuth()

    let preferences = await db.notificationPreference.findUnique({
      where: { userId: user.id },
    })

    if (!preferences) {
      preferences = await db.notificationPreference.create({
        data: { userId: user.id, ...DEFAULT_PREFERENCES },
      })
    }

    return ok(preferences)
  } catch (err) {
    if ((err as Error).message === 'AuthError') return unauthorized()
    console.error('[notifications preferences GET] failed:', err)
    return internalError('Failed to load preferences')
  }
}

// PUT /api/notifications/preferences — تحديث تفضيلات الإشعارات
export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await req.json()
    const parsed = UpdatePreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const data = parsed.data

    const updateData: Record<string, unknown> = {}
    if (data.emailEnabled !== undefined) updateData.emailEnabled = data.emailEnabled
    if (data.pushEnabled !== undefined) updateData.pushEnabled = data.pushEnabled
    if (data.dailySummary !== undefined) updateData.dailySummary = data.dailySummary
    if (data.summaryIntervalDays !== undefined) updateData.summaryIntervalDays = data.summaryIntervalDays
    if (data.likeThreshold !== undefined) updateData.likeThreshold = data.likeThreshold
    if (data.quietHoursEnabled !== undefined) updateData.quietHoursEnabled = data.quietHoursEnabled
    if (data.quietHoursStart !== undefined) updateData.quietHoursStart = data.quietHoursStart
    if (data.quietHoursEnd !== undefined) updateData.quietHoursEnd = data.quietHoursEnd
    if (data.typePreferences !== undefined) {
      updateData.typePreferences = data.typePreferences as unknown as Prisma.InputJsonValue
    }

    const preferences = await db.notificationPreference.upsert({
      where: { userId: user.id },
      update: updateData,
      create: {
        userId: user.id,
        ...DEFAULT_PREFERENCES,
        ...data,
        typePreferences: (data.typePreferences ?? {}) as unknown as Prisma.InputJsonValue,
      },
    })

    return ok(preferences)
  } catch (err) {
    if ((err as Error).message === 'AuthError') return unauthorized()
    console.error('[notifications preferences PUT] failed:', err)
    return internalError('Failed to save preferences')
  }
}
