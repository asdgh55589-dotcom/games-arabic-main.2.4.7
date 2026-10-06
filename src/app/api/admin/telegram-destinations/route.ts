import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { conflict, fail, internalError, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { destinationReadiness, parseTelegramDestination } from '@/lib/telegram-destinations'
import { authErrorResponse } from '@/lib/template-lifecycle'

const PARSE_FAILURE_AR: Record<string, string> = {
  empty: 'حدّد معرّف الوجهة (رقم محادثة أو @username)',
  too_long: 'معرّف الوجهة يتجاوز 64 حرفاً',
  invalid_chat_id: 'معرّف محادثة غير صالح — رقم أو @username',
  invalid_username: 'اسم مستخدم غير صالح — استخدم @handle صالحاً',
}

const CreateDestinationSchema = z.object({
  chatId: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
})

/** إخفاء الرموز الحساسة عن كل استجابات القائمة/التفاصيل. */
function stripDestination<T extends { verificationToken?: string | null }>(
  destination: T,
): Omit<T, 'verificationToken'> & { hasVerificationToken: boolean } {
  const { verificationToken, ...rest } = destination
  return { ...rest, hasVerificationToken: Boolean(verificationToken) }
}

/**
 * قائمة + إضافة وجهات تيليجرام (manager-only، موافقته موجودة في مسار البث
 * الحالي ولا تُمس). الرموز لا تظهر في القوائم أبداً.
 */
export async function GET(req: NextRequest) {
  try {
    await requireManager()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const verificationStatus = searchParams.get('verificationStatus')
    const chatType = searchParams.get('chatType')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (verificationStatus) where.verificationStatus = verificationStatus
    if (chatType) where.chatType = chatType

    const destinations = await db.telegramDestination.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return ok({
      destinations: destinations.map((destination) => ({
        ...stripDestination(destination),
        readiness: destinationReadiness(destination),
      })),
      total: destinations.length,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations GET] failed:', err)
    return internalError('Failed to load telegram destinations')
  }
}

export async function POST(req: NextRequest) {
  try {
    const manager = await requireManager()

    const raw = await req.json().catch(() => ({}))
    const parsed = CreateDestinationSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = 'حدّد معرّف الوجهة (رقم محادثة أو @username)'
      return fail('VALIDATION_ERROR', msg, 422, { chatId: msg }, undefined, req.nextUrl.pathname)
    }

    const parseResult = parseTelegramDestination(parsed.data.chatId)
    if (!parseResult.ok) {
      const msg = PARSE_FAILURE_AR[parseResult.reason] ?? 'معرّف وجهة غير صالح'
      return fail('VALIDATION_ERROR', msg, 422, { chatId: msg }, undefined, req.nextUrl.pathname)
    }

    const existing = await db.telegramDestination.findUnique({
      where: { chatId: parseResult.ref.canonical },
    })
    if (existing) {
      return conflict('الوجهة مسجّلة بالفعل — عدّلها بدل إنشاء نسخة جديدة')
    }

    const destination = await db.telegramDestination.create({
      data: {
        chatId: parseResult.ref.canonical,
        chatType: parseResult.ref.chatType,
        username: parseResult.ref.username ?? null,
        title: parsed.data.title ?? null,
        notes: parsed.data.notes ?? null,
        status: 'pending',
        verificationStatus: 'unverified',
        addedBy: manager.id,
      },
    })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'TELEGRAM_DESTINATION_ADDED',
      entity: 'telegram_destination',
      entityId: destination.id,
      details: JSON.stringify({
        chatId: destination.chatId,
        chatType: destination.chatType,
        kind: parseResult.ref.kind,
      }),
      request: req,
    })

    return ok({
      ...stripDestination(destination),
      readiness: destinationReadiness(destination),
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    if ((err as Error)?.message?.includes('Unique constraint')) {
      return conflict('الوجهة مسجّلة بالفعل — عدّلها بدل إنشاء نسخة جديدة')
    }
    logger.error('[admin/telegram-destinations POST] failed:', err)
    return internalError('Failed to create telegram destination')
  }
}
