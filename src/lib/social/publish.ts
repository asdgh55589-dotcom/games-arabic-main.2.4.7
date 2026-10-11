/**
 * lib/social/publish.ts — محرّك نشر منشورات تليجرام.
 *
 * مسار واحد للنشر الفوري (POST .../publish) وللجدولة (cron social-publish).
 * التوكنات لا تمرّ عبر أي استجابة API — تُفكّ هنا داخلياً فقط.
 *
 * سلوك idempotency والمحاولات (الخطة §4.1):
 *  - منشور منشور مسبقاً (status='published' أو externalId موجود) → skipped.
 *  - فشل إعدادي (لا وجهة ولا env) → failed بلا استهلاك محاولة.
 *  - فشل نقل (API) → attempts+1 وstatus='failed' عند بلوغ maxAttempts،
 *    وإلا يبقى مع إعادة جدولة now+5m (backoff مطابق لـ lib/scheduler.ts).
 *  - فشل تحقق دائم (وسوم/حدود/caption>1024) → failed مباشرة، بلا تأجيل.
 */

import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { decryptBotToken } from './bot-token'
import { isRichPostSpec, toRichMessageInput } from './rich-post'
import { sendTelegramPost, type TelegramSendTarget } from './telegram-send'
import { validateSocialPost } from './validate-post'

export interface PublishActor {
  id?: string
  username?: string
}

export interface PublishOptions {
  source?: 'manual' | 'cron'
  actor?: PublishActor
}

export interface PublishResult {
  ok: boolean
  status: 'published' | 'skipped' | 'failed'
  externalId?: string
  error?: string
  /** معرّف منشور مكرر عند status='skipped'. */
  reason?:
    | 'already_published'
    | 'unsupported_platform'
    | 'misconfigured'
    | 'validation'
    | 'transport'
}

const RETRY_DELAY_MS = 5 * 60_000

/** حلّ الهدف: وجهة مُتحقَّق منها، وإلا env TELEGRAM_CHANNEL_ID. */
async function resolveTarget(post: {
  destinationId: string | null
  botId: string | null
}): Promise<{ target: TelegramSendTarget | null; error?: string }> {
  if (post.destinationId) {
    const destination = await db.telegramDestination.findUnique({
      where: { id: post.destinationId },
      select: {
        chatId: true,
        status: true,
        verificationStatus: true,
        messageThreadId: true,
        botId: true,
      },
    })
    if (!destination) {
      return { target: null, error: 'الوجهة المرتبطة بالمنشور غير موجودة' }
    }
    if (destination.status !== 'active' || destination.verificationStatus !== 'verified') {
      return {
        target: null,
        error: `الوجهة غير مؤهلة للإرسال (status=${destination.status}, verification=${destination.verificationStatus})`,
      }
    }
    const botToken = await resolveBotToken(post.botId ?? destination.botId)
    if (botToken.error) return { target: null, error: botToken.error }
    return {
      target: {
        chatId: destination.chatId,
        botToken: botToken.token,
        messageThreadId: destination.messageThreadId,
      },
    }
  }

  const envChannel = process.env.TELEGRAM_CHANNEL_ID
  if (!envChannel) {
    return {
      target: null,
      error: 'لا توجد وجهة مُتحقَّق منها ولا TELEGRAM_CHANNEL_ID في البيئة',
    }
  }
  const botToken = await resolveBotToken(post.botId)
  if (botToken.error) return { target: null, error: botToken.error }
  return { target: { chatId: envChannel, botToken: botToken.token } }
}

/**
 * حل توكن البوت: `botId` ⇒ سجل مشفّر، وإلا `null` ⇒ env
 * TELEGRAM_BOT_TOKEN. فشل فك التشفير يعود كخطأ إعدادي (لا استهلاك محاولة).
 */
async function resolveBotToken(
  botId: string | null | undefined,
): Promise<{ token: string | null; error?: string }> {
  if (!botId) return { token: null }
  const bot = await db.socialTelegramBot.findUnique({
    where: { id: botId },
    select: { tokenEnc: true, status: true },
  })
  if (!bot) return { token: null, error: `البوت ${botId} غير موجود` }
  if (bot.status !== 'active') return { token: null, error: `البوت ${botId} غير نشط` }
  try {
    return { token: decryptBotToken(bot.tokenEnc) }
  } catch {
    return { token: null, error: `تعذّر فك تشفير توكن البوت ${botId}` }
  }
}

/** علامة الفشل الدائم (تحقق/إعداد) بلا تأجيل. */
async function markPermanentFailure(
  postId: string,
  error: string,
  actor: PublishActor | undefined,
  reason: PublishResult['reason'],
): Promise<PublishResult> {
  await db.socialPost.update({
    where: { id: postId },
    data: {
      status: 'failed',
      lastError: error,
      attempts: { increment: 1 },
    },
  })
  if (actor?.id) {
    await logAction({
      userId: actor.id,
      username: actor.username,
      action: 'publish_failed',
      entity: 'social_post',
      entityId: postId,
      details: error,
    })
  }
  return { ok: false, status: 'failed', error, reason }
}

/** علامة الفشل الإعدادي بلا استهلاك محاولة (لا كتابة على الحالة). */
function misconfigured(error: string): PublishResult {
  return { ok: false, status: 'failed', error, reason: 'misconfigured' }
}

/**
 * نشر منشور واحد. لا يرمي أبداً — كل الفشل يعود ضمن `PublishResult`.
 */
export async function publishSocialPost(
  postId: string,
  opts: PublishOptions = {},
): Promise<PublishResult> {
  const source = opts.source ?? 'manual'
  const actor = opts.actor

  const post = await db.socialPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      platform: true,
      status: true,
      title: true,
      body: true,
      parseMode: true,
      richDocument: true,
      mediaUrl: true,
      destinationId: true,
      botId: true,
      externalId: true,
      attempts: true,
      maxAttempts: true,
      scheduledFor: true,
    },
  })

  if (!post) {
    return { ok: false, status: 'failed', error: 'المنشور غير موجود', reason: 'misconfigured' }
  }

  // idempotency
  if (post.status === 'published' || post.externalId) {
    return {
      ok: true,
      status: 'skipped',
      externalId: post.externalId ?? undefined,
      reason: 'already_published',
    }
  }

  if (post.platform !== 'telegram') {
    return {
      ok: false,
      status: 'failed',
      error: `المنصة «${post.platform}» غير مدعومة للنشر بعد`,
      reason: 'unsupported_platform',
    }
  }

  // الهدف (فشل إعدادي = بلا استهلاك محاولة)
  const resolved = await resolveTarget(post)
  if (!resolved.target) {
    return misconfigured(resolved.error ?? 'تعذّر تحديد هدف الإرسال')
  }

  // التحقق المسبق (وسوم/حدود/bidi) — بلا استهلاك شبكة.
  const richSpec = isRichPostSpec(post.richDocument) ? post.richDocument : null
  if (post.richDocument != null && !richSpec) {
    return markPermanentFailure(
      postId,
      'مواصفة الرسالة الغنية غير صالحة — عدّل المنشور ثم أعد النشر',
      actor,
      'validation',
    )
  }

  const validation = validateSocialPost({
    title: post.title,
    body: post.body,
    parseMode: post.parseMode,
    mediaUrl: post.mediaUrl,
    richDocument: richSpec,
  })

  if (!validation.ok) {
    const detail = validation.issues.map((issue) => issue.message).join(' | ')
    return markPermanentFailure(postId, `فشل التحقق: ${detail}`, actor, 'validation')
  }

  // caption > 1024 مع وسائط = فشل تحقق دائم قبل الإرسال.
  if (validation.preview.photo && !validation.preview.photo.captionWithinLimit) {
    return markPermanentFailure(
      postId,
      'التعليق مع الوسائط يتجاوز 1024 حرفاً — قصّر النص أو أزل الوسائط',
      actor,
      'validation',
    )
  }

  // ===== الإرسال =====
  const sendResult = await sendTelegramPost({
    target: resolved.target,
    text: validation.preview.text,
    parseMode: validation.preview.parseMode,
    photoUrl: validation.preview.photo?.url ?? null,
    rich: richSpec ? toRichMessageInput(richSpec, { isRtl: true }) : null,
    protectContent: false,
  })

  if (sendResult.ok) {
    const externalId = sendResult.messageId != null ? String(sendResult.messageId) : null
    await db.socialPost.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        externalId,
        attempts: { increment: 1 },
        lastError: null,
      },
    })
    if (actor?.id) {
      await logAction({
        userId: actor.id,
        username: actor.username,
        action: 'publish',
        entity: 'social_post',
        entityId: postId,
        details: `نشر عبر ${sendResult.method} (${source})`,
        metadata: { externalId, method: sendResult.method, source },
      })
    }
    return { ok: true, status: 'published', externalId: externalId ?? undefined }
  }

  // ===== فشل نقل =====
  const error = sendResult.error ?? 'فشل الإرسال إلى تليجرام'
  const nextAttempts = post.attempts + 1
  const exhausted = nextAttempts >= post.maxAttempts

  await db.socialPost.update({
    where: { id: postId },
    data: {
      status: exhausted ? 'failed' : 'scheduled',
      lastError: error,
      attempts: { increment: 1 },
      // backoff بسيط مطابق لـ lib/scheduler.ts (5 دقائق)
      ...(exhausted ? {} : { scheduledFor: new Date(Date.now() + RETRY_DELAY_MS) }),
    },
  })

  if (actor?.id) {
    await logAction({
      userId: actor.id,
      username: actor.username,
      action: 'publish_failed',
      entity: 'social_post',
      entityId: postId,
      details: error,
      metadata: { attempts: nextAttempts, exhausted, source },
    })
  }

  logger.warn(
    `[social-publish] post ${postId} failed (attempt ${nextAttempts}/${post.maxAttempts}): ${error}`,
  )
  return { ok: false, status: 'failed', error }
}
