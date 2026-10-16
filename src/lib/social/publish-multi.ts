/**
 * lib/social/publish-multi.ts — محرك النشر متعدد الوجهات (المرحلة 3).
 *
 * يقرأ `SocialPostTarget` → لكل هدف: مطالبة ذرّية (`updateMany` مشروط
 * إلى `sending`) → حلّ البوت (هدف ← وجهة ← env) → إرسال مخنوق →
 * كتابة `SocialPostDelivery` (صف للتاريخ لكل محاولة — لا يُحدَّث أبداً).
 *
 * تجميع المنشور: منشور `published` فقط عندما تُرسل **كل** الأهداف،
 * و`failed` عندما تفشل **كلها** استنفاداً، وإلا يبقى `scheduled` مع
 * `lastError` مُجمّع. بلا أهداف إطلاقاً يُفوَّض للمسار الأحادي القديم
 * (`publishSocialPost`) — توافق كامل.
 *
 * التوكنات داخلية فقط (حلّ ← إرسال) — لا تظهر في أي نتيجة أو سجل.
 */

import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { botTokenFingerprint, resolveTargetBot, throttleBotSend } from './bot-resolve'
import { PUBLISH_LEASE_MS, publishSocialPost, type PublishActor, type PublishOptions } from './publish'
import { isRichPostSpec, toRichMessageInput } from './rich-post'
import {
  deleteTelegramMessage,
  editTelegramMessage,
  sendTelegramPost,
} from './telegram-send'
import { validateSocialPost } from './validate-post'

export type MultiTargetStatus = 'sent' | 'failed' | 'skipped'

export interface MultiTargetResult {
  targetId: string
  destinationId: string
  status: MultiTargetStatus
  externalMessageId?: string
  error?: string
}

export interface MultiPublishResult {
  ok: boolean
  published: number
  failed: number
  skipped: number
  targets: MultiTargetResult[]
  error?: string
}

/** مهلة الخنق بين إرسالين لنفس البوت (≤10/ثانية — تحت سقف 30 بهامش). */
const BOT_SEND_SPACING_MS = 100

/** مطالبة ذرّية بهدف واحد: معلَّق/فاشل، أو sending منتهي العقد. */
async function claimPostTarget(targetId: string): Promise<'claimed' | 'busy'> {
  const leaseCutoff = new Date(Date.now() - PUBLISH_LEASE_MS)
  const claimed = await db.socialPostTarget.updateMany({
    where: {
      id: targetId,
      OR: [
        { status: { in: ['pending', 'failed'] } },
        { status: 'sending', updatedAt: { lt: leaseCutoff } },
      ],
    },
    data: { status: 'sending', lastError: null },
  })
  return claimed.count > 0 ? 'claimed' : 'busy'
}

interface LoadedTarget {
  id: string
  status: string
  botId: string | null
  threadId: number | null
  attempts: number
  externalMessageId: string | null
  destinationId: string
  destination: {
    chatId: string
    status: string
    verificationStatus: string
    archivedAt: Date | null
    botId: string | null
    messageThreadId: number | null
  } | null
}

/** فشل إعدادي على مستوى الهدف: يُعلَّم failed بلا استهلاك محاولة. */
async function markTargetMisconfigured(
  targetId: string,
  error: string,
): Promise<MultiTargetResult & { destinationId: string }> {
  const target = await db.socialPostTarget.update({
    where: { id: targetId },
    data: { status: 'failed', error },
    select: { id: true, destinationId: true },
  })
  return { targetId: target.id, destinationId: target.destinationId, status: 'failed', error }
}

/**
 * نشر منشور على كل أهدافه. لا يرمي — الفشل يعود ضمن النتيجة.
 */
export async function publishSocialPostMulti(
  postId: string,
  opts: PublishOptions = {},
): Promise<MultiPublishResult> {
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
    return {
      ok: false,
      published: 0,
      failed: 0,
      skipped: 0,
      targets: [],
      error: 'المنشور غير موجود',
    }
  }

  const targets = (await db.socialPostTarget.findMany({
    where: { postId },
    include: {
      destination: {
        select: {
          chatId: true,
          status: true,
          verificationStatus: true,
          archivedAt: true,
          botId: true,
          messageThreadId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })) as LoadedTarget[]

  // idempotency على مستوى المنشور.
  if (post.status === 'published' || post.externalId) {
    return {
      ok: true,
      published: 0,
      failed: 0,
      skipped: Math.max(targets.length, 1),
      targets: targets.map((t) => ({
        targetId: t.id,
        destinationId: t.destinationId,
        status: 'skipped' as const,
        externalMessageId: t.externalMessageId ?? undefined,
        error: 'المنشور منشور مسبقاً',
      })),
    }
  }

  if (post.platform !== 'telegram') {
    return {
      ok: false,
      published: 0,
      failed: 0,
      skipped: 0,
      targets: [],
      error: `المنصة «${post.platform}» غير مدعومة للنشر بعد`,
    }
  }

  // بلا أهداف: المسار الأحادي القديم (توافق).
  if (targets.length === 0) {
    const legacy = await publishSocialPost(postId, opts)
    return {
      ok: legacy.ok,
      published: legacy.status === 'published' ? 1 : 0,
      failed: legacy.status === 'failed' ? 1 : 0,
      skipped: legacy.status === 'skipped' ? 1 : 0,
      targets: [],
      error: legacy.error,
    }
  }

  // التحقق المسبق مرة واحدة لكل الأهداف.
  const richSpec = isRichPostSpec(post.richDocument) ? post.richDocument : null
  if (post.richDocument != null && !richSpec) {
    const error = 'مواصفة الرسالة الغنية غير صالحة — عدّل المنشور ثم أعد النشر'
    await failPostContent(postId, targets, error, actor)
    return {
      ok: false,
      published: 0,
      failed: targets.length,
      skipped: 0,
      targets: targets.map((t) => ({
        targetId: t.id,
        destinationId: t.destinationId,
        status: 'failed' as const,
        error,
      })),
      error,
    }
  }

  const validation = validateSocialPost({
    title: post.title,
    body: post.body,
    parseMode: post.parseMode,
    mediaUrl: post.mediaUrl,
    richDocument: richSpec,
  })
  const captionOverflow = Boolean(
    validation.preview.photo && !validation.preview.photo.captionWithinLimit,
  )
  if (!validation.ok || captionOverflow) {
    const detail = !validation.ok
      ? validation.issues.map((issue) => issue.message).join(' | ')
      : 'التعليق مع الوسائط يتجاوز 1024 حرفاً — قصّر النص أو أزل الوسائط'
    const error = `فشل التحقق: ${detail}`
    await failPostContent(postId, targets, error, actor)
    return {
      ok: false,
      published: 0,
      failed: targets.length,
      skipped: 0,
      targets: targets.map((t) => ({
        targetId: t.id,
        destinationId: t.destinationId,
        status: 'failed' as const,
        error,
      })),
      error,
    }
  }

  const results: MultiTargetResult[] = []
  let attempted = false

  for (const target of targets) {
    // مُرسل سابقاً أو مُتخطى: لا يُعاد.
    if (target.status === 'sent' || target.status === 'skipped') {
      results.push({
        targetId: target.id,
        destinationId: target.destinationId,
        status: 'skipped',
        externalMessageId: target.externalMessageId ?? undefined,
        error: target.status === 'sent' ? 'مُرسل سابقاً' : undefined,
      })
      continue
    }

    // أهلية الوجهة (مطابق لمسار publish.ts الأحادي).
    const dest = target.destination
    if (!dest || dest.archivedAt || dest.status !== 'active' || dest.verificationStatus !== 'verified') {
      const error = !dest
        ? 'الوجهة المرتبطة بالهدف غير موجودة'
        : dest.archivedAt
          ? 'الوجهة مؤرشفة — أعد ربط الهدف لوجهة نشطة'
          : `الوجهة غير مؤهلة للإرسال (status=${dest.status})`
      results.push(await markTargetMisconfigured(target.id, error))
      continue
    }

    // المطالبة الذرّية قبل أي إرسال.
    if ((await claimPostTarget(target.id)) === 'busy') {
      const current = await db.socialPostTarget.findUnique({
        where: { id: target.id },
        select: { status: true, externalMessageId: true },
      })
      if (current && (current.status === 'sent' || current.externalMessageId)) {
        results.push({
          targetId: target.id,
          destinationId: target.destinationId,
          status: 'skipped',
          externalMessageId: current.externalMessageId ?? undefined,
          error: 'مُرسل سابقاً',
        })
      } else {
        results.push({
          targetId: target.id,
          destinationId: target.destinationId,
          status: 'skipped',
          error: 'ناشر آخر يرسل هذا الهدف الآن',
        })
      }
      continue
    }

    // حلّ البوت: هدف ← وجهة ← env.
    const resolved = await resolveTargetBot({
      targetBotId: target.botId,
      destinationBotId: dest.botId,
    })
    if (!resolved.ok || !resolved.token) {
      results.push(await markTargetMisconfigured(target.id, resolved.error ?? 'تعذّر حل البوت'))
      continue
    }

    // الإرسال المخنوق.
    attempted = true
    await throttleBotSend(botTokenFingerprint(resolved.token), BOT_SEND_SPACING_MS)
    const sendResult = await sendTelegramPost({
      target: {
        chatId: dest.chatId,
        botToken: resolved.token,
        messageThreadId: target.threadId ?? dest.messageThreadId ?? null,
      },
      text: validation.preview.text,
      parseMode: validation.preview.parseMode,
      photoUrl: validation.preview.photo?.url ?? null,
      rich: richSpec ? toRichMessageInput(richSpec, { isRtl: true }) : null,
      protectContent: false,
    })

    if (sendResult.ok) {
      const externalId = sendResult.messageId != null ? String(sendResult.messageId) : null
      const updated = await db.socialPostTarget.update({
        where: { id: target.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          externalMessageId: externalId,
          attempts: { increment: 1 },
          error: null,
        },
        select: { attempts: true },
      })
      await db.socialPostDelivery.create({
        data: {
          postId,
          destinationId: target.destinationId,
          botId: resolved.botId,
          threadId: target.threadId ?? dest.messageThreadId ?? null,
          status: 'sent',
          externalMessageId: externalId,
          attempts: updated.attempts,
          sentAt: new Date(),
        },
      })
      results.push({
        targetId: target.id,
        destinationId: target.destinationId,
        status: 'sent',
        externalMessageId: externalId ?? undefined,
      })
      continue
    }

    // فشل نقل: استنفاد ⇒ failed، وإلا pending للمحاولة التالية.
    const error = sendResult.error ?? 'فشل الإرسال إلى تليجرام'
    const nextAttempts = target.attempts + 1
    const exhausted = nextAttempts >= post.maxAttempts
    await db.socialPostTarget.update({
      where: { id: target.id },
      data: {
        status: exhausted ? 'failed' : 'pending',
        error,
        attempts: { increment: 1 },
      },
    })
    await db.socialPostDelivery.create({
      data: {
        postId,
        destinationId: target.destinationId,
        botId: resolved.botId,
        threadId: target.threadId ?? dest.messageThreadId ?? null,
        status: 'failed',
        error,
        attempts: nextAttempts,
      },
    })
    logger.warn(
      `[social-publish-multi] target ${target.id} of post ${postId} failed (attempt ${nextAttempts}/${post.maxAttempts}): ${error}`,
    )
    results.push({
      targetId: target.id,
      destinationId: target.destinationId,
      status: exhausted ? 'failed' : 'skipped',
      error,
    })
  }

  // ===== تجميع حالة المنشور =====
  const finalStates = new Map<string, string>()
  for (const t of targets) {
    const r = results.find((x) => x.targetId === t.id)
    finalStates.set(t.id, r?.status === 'sent' ? 'sent' : r?.status === 'failed' ? 'failed' : t.status)
  }
  // أهداف كانت sent قبل التشغيل تبقى sent.
  for (const t of targets) {
    if (t.status === 'sent' && finalStates.get(t.id) !== 'sent') {
      finalStates.set(t.id, 'sent')
    }
  }
  const states = [...finalStates.values()]
  const allSent = states.length > 0 && states.every((s) => s === 'sent')
  const allFailed = states.length > 0 && states.every((s) => s === 'failed')
  const errors = results
    .map((r) => r.error)
    .filter((e): e is string => Boolean(e))
  const aggregated = errors.length > 0 ? [...new Set(errors)].join(' | ').slice(0, 500) : null

  if (allSent) {
    const firstExternal = results.find((r) => r.externalMessageId)?.externalMessageId
    await db.socialPost.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        externalId: firstExternal ?? post.externalId,
        attempts: attempted ? { increment: 1 } : undefined,
        lastError: null,
      },
    })
  } else if (allFailed) {
    await db.socialPost.update({
      where: { id: postId },
      data: {
        status: 'failed',
        lastError: aggregated,
        attempts: attempted ? { increment: 1 } : undefined,
      },
    })
  } else if (attempted || aggregated) {
    await db.socialPost.update({
      where: { id: postId },
      data: {
        lastError: aggregated,
        attempts: attempted ? { increment: 1 } : undefined,
      },
    })
  }

  if (actor?.id) {
    await logAction({
      userId: actor.id,
      username: actor.username,
      action: 'publish_multi',
      entity: 'social_post',
      entityId: postId,
      details: `نشر متعدد: ${results.filter((r) => r.status === 'sent').length}/${targets.length} أهداف`,
    })
  }

  const published = results.filter((r) => r.status === 'sent').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.length - published - failed
  return { ok: failed === 0, published, failed, skipped, targets: results }
}

/** فشل محتوى دائم: المنشور failed وكل الأهداف المعلقة failed مع حرق محاولة. */
async function failPostContent(
  postId: string,
  targets: LoadedTarget[],
  error: string,
  actor: PublishActor | undefined,
): Promise<void> {
  await db.socialPost.update({
    where: { id: postId },
    data: { status: 'failed', lastError: error, attempts: { increment: 1 } },
  })
  await db.socialPostTarget.updateMany({
    where: { postId, status: { in: ['pending', 'failed'] } },
    data: { status: 'failed', error },
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
}

export interface EditMessagesResult {
  ok: boolean
  edited: number
  failed: number
  failures: Array<{ targetId: string; error?: string }>
}

/**
 * تعديل الرسائل المرسلة (editMessageText) — لهدف معين أو كل المُرسلة.
 * كل نجاح يُوثَّق بصف تسليم جديد (رقم المراجعة = عدد صفوف sent السابقة).
 */
export async function editSentMessages(
  postId: string,
  opts: { text?: string; targetId?: string; actor?: PublishActor } = {},
): Promise<EditMessagesResult> {
  const post = await db.socialPost.findUnique({
    where: { id: postId },
    select: { id: true, body: true, parseMode: true },
  })
  if (!post) {
    return { ok: false, edited: 0, failed: 0, failures: [{ targetId: '', error: 'المنشور غير موجود' }] }
  }
  const text = (opts.text ?? post.body ?? '').trim()
  if (!text) {
    return { ok: false, edited: 0, failed: 0, failures: [{ targetId: '', error: 'النص فارغ' }] }
  }
  if (text.length > 4096) {
    return {
      ok: false,
      edited: 0,
      failed: 0,
      failures: [{ targetId: '', error: 'النص يتجاوز 4096 حرفاً' }],
    }
  }

  const targets = await db.socialPostTarget.findMany({
    where: {
      postId,
      ...(opts.targetId ? { id: opts.targetId } : {}),
      status: 'sent',
      externalMessageId: { not: null },
    },
    include: {
      destination: {
        select: { chatId: true, botId: true },
      },
    },
  })

  let edited = 0
  let failed = 0
  const failures: Array<{ targetId: string; error?: string }> = []

  for (const target of targets) {
    const messageId = Number(target.externalMessageId)
    if (!Number.isInteger(messageId)) {
      failed += 1
      failures.push({ targetId: target.id, error: 'معرف رسالة غير صالح' })
      continue
    }
    const resolved = await resolveTargetBot({
      targetBotId: target.botId,
      destinationBotId: target.destination?.botId ?? null,
    })
    if (!resolved.ok || !resolved.token || !target.destination) {
      failed += 1
      const error = resolved.error ?? 'الوجهة غير موجودة'
      await db.socialPostDelivery.create({
        data: {
          postId,
          destinationId: target.destinationId,
          botId: target.botId,
          threadId: target.threadId,
          status: 'failed',
          error,
        },
      })
      failures.push({ targetId: target.id, error })
      continue
    }

    await throttleBotSend(botTokenFingerprint(resolved.token), BOT_SEND_SPACING_MS)
    const result = await editTelegramMessage({
      token: resolved.token,
      chatId: target.destination.chatId,
      messageId,
      text,
      parseMode: post.parseMode === 'HTML' ? 'HTML' : null,
    })
    if (result.ok) {
      const priorEdits = await db.socialPostDelivery.count({
        where: { postId, destinationId: target.destinationId, status: 'sent' },
      })
      await db.socialPostDelivery.create({
        data: {
          postId,
          destinationId: target.destinationId,
          botId: resolved.botId,
          threadId: target.threadId,
          status: 'sent',
          externalMessageId: target.externalMessageId,
          sentAt: new Date(),
        },
      })
      if (opts.actor?.id) {
        await logAction({
          userId: opts.actor.id,
          username: opts.actor.username,
          action: 'publish_message_edited',
          entity: 'social_post',
          entityId: postId,
          details: `مراجعة ${priorEdits} للهدف ${target.id} (message_id=${target.externalMessageId})`,
        })
      }
      edited += 1
    } else {
      await db.socialPostDelivery.create({
        data: {
          postId,
          destinationId: target.destinationId,
          botId: resolved.botId,
          threadId: target.threadId,
          status: 'failed',
          error: result.error,
        },
      })
      failed += 1
      failures.push({ targetId: target.id, error: result.error })
    }
  }

  return { ok: failed === 0, edited, failed, failures }
}

/**
 * حذف الرسائل المرسلة (deleteMessage). عند النجاح يُعلَّم الهدف
 * `skipped` (لم يعد منشوراً عن بُعد ولا يُعاد إرساله) مع صف تسليم
 * يوثّق الحذف + سطر تدقيق.
 */
export async function deleteSentMessages(
  postId: string,
  opts: { targetId?: string; actor?: PublishActor } = {},
): Promise<EditMessagesResult> {
  const targets = await db.socialPostTarget.findMany({
    where: {
      postId,
      ...(opts.targetId ? { id: opts.targetId } : {}),
      status: 'sent',
      externalMessageId: { not: null },
    },
    include: {
      destination: {
        select: { chatId: true, botId: true },
      },
    },
  })

  let edited = 0
  let failed = 0
  const failures: Array<{ targetId: string; error?: string }> = []

  for (const target of targets) {
    const messageId = Number(target.externalMessageId)
    if (!Number.isInteger(messageId)) {
      failed += 1
      failures.push({ targetId: target.id, error: 'معرف رسالة غير صالح' })
      continue
    }
    const resolved = await resolveTargetBot({
      targetBotId: target.botId,
      destinationBotId: target.destination?.botId ?? null,
    })
    if (!resolved.ok || !resolved.token || !target.destination) {
      failed += 1
      failures.push({ targetId: target.id, error: resolved.error ?? 'الوجهة غير موجودة' })
      continue
    }

    await throttleBotSend(botTokenFingerprint(resolved.token), BOT_SEND_SPACING_MS)
    const result = await deleteTelegramMessage({
      token: resolved.token,
      chatId: target.destination.chatId,
      messageId,
    })
    if (result.ok) {
      await db.socialPostTarget.update({
        where: { id: target.id },
        data: { status: 'skipped', error: 'حُذفت الرسالة من تليجرام يدوياً' },
      })
      await db.socialPostDelivery.create({
        data: {
          postId,
          destinationId: target.destinationId,
          botId: resolved.botId,
          threadId: target.threadId,
          status: 'skipped',
          externalMessageId: target.externalMessageId,
          error: 'حُذفت الرسالة من تليجرام يدوياً',
          sentAt: new Date(),
        },
      })
      if (opts.actor?.id) {
        await logAction({
          userId: opts.actor.id,
          username: opts.actor.username,
          action: 'publish_message_deleted',
          entity: 'social_post',
          entityId: postId,
          details: `حذف message_id=${target.externalMessageId} للهدف ${target.id}`,
        })
      }
      edited += 1
    } else {
      await db.socialPostDelivery.create({
        data: {
          postId,
          destinationId: target.destinationId,
          botId: resolved.botId,
          threadId: target.threadId,
          status: 'failed',
          error: result.error,
        },
      })
      failed += 1
      failures.push({ targetId: target.id, error: result.error })
    }
  }

  return { ok: failed === 0, edited, failed, failures }
}
