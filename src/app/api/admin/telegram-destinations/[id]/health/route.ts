import type { NextRequest } from 'next/server'
import { fail, internalError, notFound, ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { decryptBotToken } from '@/lib/social/bot-token'
import { checkDestinationHealth } from '@/lib/social/destination-health'
import { authErrorResponse } from '@/lib/template-lifecycle'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/telegram-destinations/[id]/health — فحص صحة الوجهة.
 *
 * التسلسل: getMe → getChat → getChatMember عبر توكن بوت الوجهة المُسنَد،
 * وإلا TELEGRAM_BOT_TOKEN. يُخزَّن lastHealthAt/lastHealthError دائماً،
 * وتُزامَن chatType/title/username من getChat عند النجاح، ويُخبَّأ
 * postCount (عدد المنشورات المرتبطة).
 *
 * التوكن لا يظهر في أي استجابة أو سجل أو رسالة خطأ — أبداً.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const manager = await requireManager()
    const { id } = await params

    const destination = await db.telegramDestination.findUnique({ where: { id } })
    if (!destination) return notFound('الوجهة غير موجودة')

    // حلّ التوكن: بوت الوجهة أولاً، ثم env. الفشل هنا إعدادي (422) لا 500.
    let botToken: string | null = null
    if (destination.botId) {
      const bot = await db.socialTelegramBot.findUnique({
        where: { id: destination.botId },
        select: { id: true, status: true, tokenEnc: true },
      })
      if (!bot) {
        const msg = 'البوت المرتبط بالوجهة غير موجود — أعد الإسناد من صفحة الوجهات'
        return fail('BOT_NOT_FOUND', msg, 422, { botId: msg }, undefined, req.nextUrl.pathname)
      }
      if (bot.status !== 'active') {
        const msg = 'البوت المرتبط غير نشط — فعّله أو أسند بوتاً آخر قبل الفحص'
        return fail('BOT_DISABLED', msg, 422, { botId: msg }, undefined, req.nextUrl.pathname)
      }
      try {
        botToken = decryptBotToken(bot.tokenEnc)
      } catch {
        const msg = 'تعذّر فك تشفير توكن البوت — أعد إدخال التوكن من إدارة البوتات'
        return fail('BOT_TOKEN_INVALID', msg, 422, { botId: msg }, undefined, req.nextUrl.pathname)
      }
    }
    if (!botToken) {
      botToken = process.env.TELEGRAM_BOT_TOKEN || null
    }
    if (!botToken) {
      const msg = 'لا يوجد بوت مسند ولا TELEGRAM_BOT_TOKEN — أسند بوتاً للوجهة أولاً'
      return fail('NO_BOT_TOKEN', msg, 422, undefined, undefined, req.nextUrl.pathname)
    }

    const health = await checkDestinationHealth({ chatId: destination.chatId, botToken })
    const postCount = await db.socialPost.count({ where: { destinationId: id } })
    const now = new Date()

    const updateData: Record<string, unknown> = {
      lastHealthAt: now,
      lastHealthError: health.ok ? null : (health.error ?? 'فشل الفحص'),
      postCount,
    }
    if (health.ok && health.chat) {
      const knownTypes = ['private', 'group', 'supergroup', 'channel']
      if (knownTypes.includes(health.chat.type) && health.chat.type !== destination.chatType) {
        updateData.chatType = health.chat.type
      }
      if (health.chat.title && health.chat.title !== destination.title) {
        updateData.title = health.chat.title
      }
      // الصيغة الموحدة في الجدول: handle بلا @ — كما يخزّنها مسار
      // الإنشاء (parseResult.ref.username)، لأن chatId يحمل @ أصلاً.
      // هذا يطبّع أيضاً أي صف قديم خُزّن بـ @handle في فحص لاحق.
      const rawUsername =
        typeof health.chat.username === 'string' ? health.chat.username.replace(/^@/, '') : ''
      const username = rawUsername ? rawUsername : null
      if (username !== destination.username) {
        updateData.username = username
      }
    }

    // شفاء ذاتي: النوع الفعلي (بعد المزامنة) ليس منتدى وموضوع مربوط —
    // بيانات قديمة كانت ستفشل الإرسال دائماً. يُصفَّر مع إعلام صريح.
    const effectiveType = (updateData.chatType as string | undefined) ?? destination.chatType
    let threadCleared = false
    if (
      health.ok &&
      destination.messageThreadId != null &&
      effectiveType !== 'supergroup' &&
      effectiveType !== 'group'
    ) {
      updateData.messageThreadId = null
      threadCleared = true
    }

    const updated = await db.telegramDestination.update({ where: { id }, data: updateData })

    await logAction({
      userId: manager.id,
      username: manager.username,
      action: 'TELEGRAM_DESTINATION_HEALTH_CHECKED',
      entity: 'telegram_destination',
      entityId: id,
      details: JSON.stringify({
        chatId: destination.chatId,
        healthy: health.ok,
        memberStatus: health.memberStatus ?? null,
        canPost: health.canPost ?? false,
        postCount,
        threadCleared,
      }),
      request: req,
    })

    return ok({
      healthy: health.ok,
      memberStatus: health.memberStatus ?? null,
      canPost: health.canPost ?? false,
      chat: health.chat ?? null,
      postCount,
      checkedAt: now.toISOString(),
      archivedAt: updated.archivedAt,
      threadCleared,
      error: health.error ?? null,
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — إدارة الوجهات للمديرين فقط')
    if (auth) return auth
    logger.error('[admin/telegram-destinations/[id]/health POST] failed:', err)
    return internalError('Failed to check telegram destination health')
  }
}
