import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { botTokenFingerprint, resolveTargetBot, throttleBotSend } from '@/lib/social/bot-resolve'
import { sendTelegramPost } from '@/lib/social/telegram-send'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

const TestSendSchema = z.object({
  text: z.string().trim().min(1).max(1000).optional(),
})

const DEFAULT_TEST_TEXT = 'رسالة اختبار من لوحة توجيه النشر — تجاهلها. (لا تُحتسب نشراً)'

/**
 * POST /api/admin/social/telegram/routes/[id]/test — إرسال تجريبي صامت
 * عبر هدف القاعدة (بوت القاعدة ← بوت الوجهة ← env). لا يُنشئ صفوف
 * تسليم ولا يُحتسب نشراً — يُسجَّل في التدقيق فقط.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const rule = await db.socialPublishRoute.findUnique({
      where: { id },
      include: {
        destination: {
          select: { chatId: true, status: true, botId: true, messageThreadId: true },
        },
      },
    })
    if (!rule) return notFound('القاعدة غير موجودة')
    if (!rule.destination || rule.destination.status !== 'active') {
      const msg = 'وجهة القاعدة غير نشطة — فعّلها أولاً'
      return fail('VALIDATION_ERROR', msg, 422, undefined, undefined, req.nextUrl.pathname)
    }

    const raw = await req.json().catch(() => ({}))
    const parsed = TestSendSchema.safeParse(raw)
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'نص الاختبار أطول من 1000 حرف', 422, parsed.error.flatten(), undefined, req.nextUrl.pathname)
    }
    const text = parsed.data.text ?? DEFAULT_TEST_TEXT

    const resolved = await resolveTargetBot({
      targetBotId: rule.botId,
      destinationBotId: rule.destination.botId,
    })
    if (!resolved.ok || !resolved.token) {
      return fail('VALIDATION_ERROR', resolved.error ?? 'تعذّر حل البوت', 422, undefined, undefined, req.nextUrl.pathname)
    }

    await throttleBotSend(botTokenFingerprint(resolved.token))
    const sent = await sendTelegramPost({
      target: {
        chatId: rule.destination.chatId,
        botToken: resolved.token,
        messageThreadId: rule.threadId ?? rule.destination.messageThreadId ?? null,
      },
      text,
      parseMode: null,
      photoUrl: null,
      rich: null,
      protectContent: false,
    })
    if (!sent.ok) {
      return fail('SEND_FAILED', sent.error ?? 'فشل الإرسال التجريبي', 422, undefined, undefined, req.nextUrl.pathname)
    }

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'SOCIAL_ROUTE_TESTED',
      entity: 'social_publish_route',
      entityId: id,
      details: JSON.stringify({ messageId: sent.messageId ?? null }),
      request: req,
    })

    return ok({ tested: true, messageId: sent.messageId ?? null, method: sent.method })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة التوجيه للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/social/telegram/routes/[id]/test POST] failed:', err)
    return internalError('Failed to test publish route')
  }
}
