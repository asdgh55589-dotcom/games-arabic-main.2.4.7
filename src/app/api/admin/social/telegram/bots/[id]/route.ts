import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { encryptBotToken } from '@/lib/social/bot-token'
import { BotPatchSchema } from '@/lib/social/post-schemas'
import { serializeBot } from '@/lib/social/serialize'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireManager()
    const { id } = await params
    const bot = await db.socialTelegramBot.findUnique({ where: { id } })
    if (!bot) return notFound('البوت غير موجود')
    return ok(serializeBot(bot as unknown as Record<string, unknown>))
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة البوتات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/bots/[id] GET] failed:', err)
    return internalError('تعذّر تحميل البوت')
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireManager()
    const { id } = await params

    const existing = await db.socialTelegramBot.findUnique({ where: { id } })
    if (!existing) return notFound('البوت غير موجود', req.nextUrl.pathname)

    const raw = await req.json().catch(() => null)
    const parsed = BotPatchSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(
        'VALIDATION_ERROR',
        first?.message || 'بيانات البوت غير صالحة',
        422,
        parsed.error.flatten(),
        undefined,
        req.nextUrl.pathname,
      )
    }
    const input = parsed.data

    const data: Record<string, unknown> = {}
    if (input.label !== undefined) data.label = input.label
    if (input.status !== undefined) data.status = input.status
    if (input.notes !== undefined) data.notes = input.notes ?? null
    if (input.token !== undefined) {
      try {
        data.tokenEnc = encryptBotToken(input.token)
      } catch {
        return internalError('تعذّر تشفير توكن البوت — تحقق من JWT_SECRET')
      }
    }

    if (Object.keys(data).length === 0) {
      return fail(
        'VALIDATION_ERROR',
        'لا توجد حقول للتعديل',
        422,
        undefined,
        undefined,
        req.nextUrl.pathname,
      )
    }

    const updated = await db.socialTelegramBot.update({ where: { id }, data })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'update_bot',
      entity: 'social_telegram_bot',
      entityId: id,
      details: `تعديل بوت «${updated.label}»`,
      request: req,
    })

    return ok(serializeBot(updated as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة البوتات للمديرين فقط')
    logger.error('[admin/social/telegram/bots/[id] PATCH] failed:', err)
    return internalError('تعذّر تعديل البوت')
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireManager()
    const { id } = await params

    const existing = await db.socialTelegramBot.findUnique({
      where: { id },
      select: { id: true, label: true },
    })
    if (!existing) return notFound('البوت غير موجود', req.nextUrl.pathname)

    await db.socialTelegramBot.delete({ where: { id } })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'delete_bot',
      entity: 'social_telegram_bot',
      entityId: id,
      details: `حذف بوت «${existing.label}»`,
      request: req,
    })

    return ok({ deleted: true, id })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة البوتات للمديرين فقط')
    logger.error('[admin/social/telegram/bots/[id] DELETE] failed:', err)
    return internalError('تعذّر حذف البوت')
  }
}
