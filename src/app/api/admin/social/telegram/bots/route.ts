import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { encryptBotToken } from '@/lib/social/bot-token'
import { BotCreateSchema } from '@/lib/social/post-schemas'
import { serializeBot } from '@/lib/social/serialize'
import { authErrorResponse } from '@/lib/template-lifecycle'

export async function GET() {
  try {
    await requireManager()

    const bots = await db.socialTelegramBot.findMany({
      select: { id: true, label: true, botUsername: true, status: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })

    return ok({ bots, total: bots.length })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة البوتات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/bots GET] failed:', err)
    return internalError('Failed to load telegram bots')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireManager()

    const raw = await req.json().catch(() => null)
    const parsed = BotCreateSchema.safeParse(raw)
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
    let tokenEnc: string
    try {
      tokenEnc = encryptBotToken(input.token)
    } catch {
      return internalError('تعذّر تشفير توكن البوت — تحقق من JWT_SECRET')
    }

    const bot = await db.socialTelegramBot.create({
      data: {
        label: input.label,
        tokenEnc,
        notes: input.notes ?? null,
        status: 'active',
        createdById: user.id,
      },
    })

    await logAction({
      userId: user.id,
      username: user.username,
      action: 'create_bot',
      entity: 'social_telegram_bot',
      entityId: bot.id,
      details: `إنشاء بوت «${bot.label}»`,
      request: req,
    })

    return ok(serializeBot(bot as unknown as Record<string, unknown>))
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — إدارة البوتات للمديرين فقط')
    logger.error('[admin/social/telegram/bots POST] failed:', err)
    return internalError('تعذّر إنشاء البوت')
  }
}
