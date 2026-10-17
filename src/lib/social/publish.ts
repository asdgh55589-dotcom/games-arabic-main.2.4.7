/**
 * lib/social/publish.ts — محرّك نشر منشورات تليجرام.
 *
 * مسار واحد للنشر الفوري (POST .../publish) وللجدولة (cron social-publish).
 * التوكنات لا تمرّ عبر أي استجابة API — تُفكّ هنا داخلياً فقط.
 *
 * سلوك idempotency والمحاولات (الخطة §4.1):
 *  - منشور منشور مسبقاً (status='published' أو externalId موجود) → skipped.
 *  - مطالبة ذرّية قبل الإرسال: `updateMany` مشروط ينقل إلى
 *    `publishing`؛ ناشر موازٍ يجد الصف محجوزاً فيُتخطى
 *    (`in_progress`) بدل الإرسال المكرر. عقد المطالبة 15 دقيقة —
 *    صف `publishing` منتهي العقد يُستعاد (تعطّل العامل).
 *  - فشل إعدادي (لا وجهة ولا env) → failed بلا استهلاك محاولة.
 *  - فشل نقل (API) → attempts+1 وstatus='failed' عند بلوغ maxAttempts،
 *    وإلا يبقى مع إعادة جدولة now+5m (backoff مطابق لـ lib/scheduler.ts).
 *  - فشل تحقق دائم (وسوم/حدود/caption>1024) → failed مباشرة، بلا تأجيل.
 */

import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { PublishErrorScope } from '@/lib/publish-errors'
import { classifyTransportError, publishErrorDef } from '@/lib/publish-errors'
import { decryptBotToken } from './bot-token'
import {
  notifyPublishFailure,
  notifyPublishSuccess,
  recordPublishError,
  resolvePublishErrorsOpen,
} from './publish-error-events'
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
    | 'in_progress'
    | 'unsupported_platform'
    | 'misconfigured'
    | 'validation'
    | 'transport'
  /** مرحلة 6: رمز الكتالوج المصاحب للفشل (display + fix). */
  code?: string
}

const RETRY_DELAY_MS = 5 * 60_000

/**
 * مدة عقد المطالبة: صف `publishing` أقدم من هذا يُعدّ عملية انكسرت
 * (تعطّل بين المطالبة والإرسال) وقابلًا للاستعادة. أطول بكثير من زمن
 * إرسال واحد كي لا تُستعاد مطالبة ما تزال حيّة فيُرسل مكرراً.
 * مُصدَّر لمحرك النشر المتعدد (نفس العقد لمطالبات الأهداف).
 */
export const PUBLISH_LEASE_MS = 15 * 60_000

/**
 * مطالبة ذرّية بصف المنشور قبل أي إرسال: تحديث مشروط واحد ينتقل إلى
 * `publishing`، فعدّاد الصفوف هو الحَكَم — لا قراءة-ثم-كتابة. ناشر
 * موازٍ (tick ثانٍ، أو زر يدوي) يجد الصف محجوزاً فيُتخطى بدل أن يرسل
 * المحتوى ذاته مرتين. صفوف `publishing` منتهية العقد تُستعاد كي لا
 * تبقى معلقة للأبد بعد تعطّل العامل.
 */
async function claimPostForPublish(postId: string): Promise<'claimed' | 'busy'> {
  const leaseCutoff = new Date(Date.now() - PUBLISH_LEASE_MS)
  const claimed = await db.socialPost.updateMany({
    where: {
      id: postId,
      OR: [
        { status: { notIn: ['published', 'publishing'] } },
        { status: 'publishing', updatedAt: { lt: leaseCutoff } },
      ],
    },
    data: { status: 'publishing', lastError: null },
  })
  return claimed.count > 0 ? 'claimed' : 'busy'
}

/** حلّ الهدف: وجهة مُتحقَّق منها، وإلا env TELEGRAM_CHANNEL_ID. */
async function resolveTarget(post: {
  destinationId: string | null
  botId: string | null
}): Promise<{
  target: TelegramSendTarget | null
  error?: string
  code?: string
  refId?: string | null
}> {
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
      return {
        target: null,
        error: 'الوجهة المرتبطة بالمنشور غير موجودة',
        code: 'destination_missing',
        refId: post.destinationId,
      }
    }
    if (destination.status !== 'active' || destination.verificationStatus !== 'verified') {
      return {
        target: null,
        error: `الوجهة غير مؤهلة للإرسال (status=${destination.status}, verification=${destination.verificationStatus})`,
        code: 'destination_not_qualified',
        refId: post.destinationId,
      }
    }
    const botToken = await resolveBotToken(post.botId ?? destination.botId)
    if (botToken.error)
      return { target: null, error: botToken.error, code: botToken.code, refId: post.destinationId }
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
      code: 'env_channel_missing',
      refId: null,
    }
  }
  const botToken = await resolveBotToken(post.botId)
  if (botToken.error)
    return { target: null, error: botToken.error, code: botToken.code, refId: null }
  return { target: { chatId: envChannel, botToken: botToken.token } }
}

/**
 * حل توكن البوت: `botId` ⇒ سجل مشفّر، وإلا `null` ⇒ env
 * TELEGRAM_BOT_TOKEN. فشل فك التشفير يعود كخطأ إعدادي (لا استهلاك محاولة)
 * مع رمز كتالوج (مرحلة 6).
 */
async function resolveBotToken(
  botId: string | null | undefined,
): Promise<{ token: string | null; error?: string; code?: string; refId?: string | null }> {
  if (!botId) return { token: null }
  const bot = await db.socialTelegramBot.findUnique({
    where: { id: botId },
    select: { tokenEnc: true, status: true },
  })
  if (!bot)
    return { token: null, error: `البوت ${botId} غير موجود`, code: 'bot_missing', refId: botId }
  if (bot.status !== 'active')
    return { token: null, error: `البوت ${botId} غير نشط`, code: 'bot_not_active', refId: botId }
  try {
    return { token: decryptBotToken(bot.tokenEnc) }
  } catch {
    return {
      token: null,
      error: `تعذّر فك تشفير توكن البوت ${botId}`,
      code: 'bot_token_decrypt',
      refId: botId,
    }
  }
}

/** علامة الفشل الدائم (تحقق/إعداد) بلا تأجيل. */
async function markPermanentFailure(
  postId: string,
  error: string,
  actor: PublishActor | undefined,
  reason: PublishResult['reason'],
  opts: {
    code?: string
    attempt?: number
    scope?: PublishErrorScope
    refId?: string | null
  } = {},
): Promise<PublishResult> {
  await db.socialPost.update({
    where: { id: postId },
    data: {
      status: 'failed',
      lastError: error,
      attempts: { increment: 1 },
    },
  })

  // مرحلة 6: كل فشل يكتب PublishErrorEvent بهذا الرمز.
  const code = opts.code ?? (reason === 'validation' ? 'validation_failed' : 'unknown')
  await recordPublishError({
    code,
    scope: opts.scope ?? 'post',
    refId: opts.refId ?? postId,
    message: error,
    attempt: opts.attempt,
  })
  await notifyPublishFailure({ postId, errorText: error, code, fixAr: publishErrorDef(code).fixAr })

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
  return { ok: false, status: 'failed', error, reason, code }
}

/** فشل إعدادي بلا استهلاك محاولة (لا كتابة على الحالة) — مع تسجيل الحدث. */
async function misconfigured(
  postId: string,
  error: string,
  code?: string,
  refId?: string | null,
): Promise<PublishResult> {
  const resolvedCode = code ?? 'unknown'
  await recordPublishError({
    code: resolvedCode,
    scope: 'post',
    refId: refId ?? postId,
    message: error,
  })
  await notifyPublishFailure({
    postId,
    errorText: error,
    code: resolvedCode,
    fixAr: publishErrorDef(resolvedCode).fixAr,
  })
  return { ok: false, status: 'failed', error, reason: 'misconfigured', code: resolvedCode }
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
      createdById: true,
    },
  })

  if (!post) {
    return {
      ok: false,
      status: 'failed',
      error: 'المنشور غير موجود',
      reason: 'misconfigured',
      code: 'unknown',
    }
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
      code: 'unsupported_platform',
    }
  }

  // الهدف (فشل إعدادي = بلا استهلاك محاولة) — مرحلة 6: رمز + حدث + إشعار.
  const resolved = await resolveTarget(post)
  if (!resolved.target) {
    return misconfigured(
      postId,
      resolved.error ?? 'تعذّر تحديد هدف الإرسال',
      resolved.code,
      resolved.refId ?? null,
    )
  }

  // التحقق المسبق (وسوم/حدود/bidi) — بلا استهلاك شبكة.
  const richSpec = isRichPostSpec(post.richDocument) ? post.richDocument : null
  if (post.richDocument != null && !richSpec) {
    return markPermanentFailure(
      postId,
      'مواصفة الرسالة الغنية غير صالحة — عدّل المنشور ثم أعد النشر',
      actor,
      'validation',
      { code: 'rich_spec_invalid' },
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
    return markPermanentFailure(postId, `فشل التحقق: ${detail}`, actor, 'validation', {
      code: 'validation_failed',
    })
  }

  // caption > 1024 مع وسائط = فشل تحقق دائم قبل الإرسال.
  if (validation.preview.photo && !validation.preview.photo.captionWithinLimit) {
    return markPermanentFailure(
      postId,
      'التعليق مع الوسائط يتجاوز 1024 حرفاً — قصّر النص أو أزل الوسائط',
      actor,
      'validation',
      { code: 'caption_too_long' },
    )
  }

  // ===== الإرسال (بعد مطالبة ذرّية — لا قراءة-ثم-إرسال) =====
  if ((await claimPostForPublish(postId)) === 'busy') {
    // ناشر آخر سبقنا: إما نُشر فعلاً أو ما يزال يرسل ضمن العقد.
    // نعيد القراءة لتمييز الحالتين في السبب.
    const current = await db.socialPost.findUnique({
      where: { id: postId },
      select: { status: true, externalId: true },
    })
    if (current && (current.status === 'published' || current.externalId)) {
      return {
        ok: true,
        status: 'skipped',
        externalId: current.externalId ?? undefined,
        reason: 'already_published',
      }
    }
    return {
      ok: true,
      status: 'skipped',
      externalId: undefined,
      reason: 'in_progress',
    }
  }

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

    // مرحلة 6: النجاح يحلّ الأحداث المفتوحة تلقائياً + نجاح خفيف للمؤلف.
    await resolvePublishErrorsOpen([
      { scope: 'post', refId: postId },
      { scope: 'destination', refId: post.destinationId },
      { scope: 'bot', refId: post.botId },
    ])
    await notifyPublishSuccess({
      postId,
      postTitle: post.title,
      authorId: post.createdById ?? null,
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
  const transportCode = classifyTransportError(error)

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

  // مرحلة 6: حدث لنقل الرمز (نطاق المنشور + كيانات الهدف) — إشعار فقط
  // عند النضوب (فشل نهائي) حتى لا تُرِق كل محاولة backoff.
  await recordPublishError({
    code: transportCode,
    scope: 'post',
    refId: postId,
    message: error,
    attempt: nextAttempts,
  })
  await recordPublishError({
    code: transportCode,
    scope: 'destination',
    refId: post.destinationId,
    message: error,
    attempt: nextAttempts,
  })
  await recordPublishError({
    code: transportCode,
    scope: 'bot',
    refId: post.botId,
    message: error,
    attempt: nextAttempts,
  })
  if (!exhausted && !publishErrorDef(transportCode).retryable) {
    // رمز غير قابل للإعادة لا يجوز بقاءه `scheduled` — فشل نهائي فوري.
    await db.socialPost.update({
      where: { id: postId },
      data: { status: 'failed' },
    })
  }
  if (exhausted) {
    await notifyPublishFailure({
      postId,
      postTitle: post.title,
      errorText: error,
      code: transportCode,
      fixAr: publishErrorDef(transportCode).fixAr,
      attempt: nextAttempts,
    })
  }

  if (actor?.id) {
    await logAction({
      userId: actor.id,
      username: actor.username,
      action: 'publish_failed',
      entity: 'social_post',
      entityId: postId,
      details: error,
      metadata: { attempts: nextAttempts, exhausted, source, code: transportCode },
    })
  }

  logger.warn(
    `[social-publish] post ${postId} failed (attempt ${nextAttempts}/${post.maxAttempts}): ${error}`,
  )
  return { ok: false, status: 'failed', error, code: transportCode }
}
