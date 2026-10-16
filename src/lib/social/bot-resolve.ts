/**
 * lib/social/bot-resolve.ts — حلّ البوت المسؤول عن إرسال واحد + خنق الإرسال.
 *
 * ترتيب الإسناد (المرحلة 3): بوت الهدف الصريح ← بوت الوجهة ← البوت
 * الافتراضي (env TELEGRAM_BOT_TOKEN). ملاحظة: `SocialBotRule` (المرحلة 2)
 * غير موجود بعد — عند هبوطه يُدرج بين إسناد الوجهة والافتراضي هنا فقط.
 *
 * التوكن يُمرَّر داخلياً للمرسِل فقط — لا يظهر في أي استجابة أو سجل.
 */

import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { decryptBotToken } from './bot-token'

export type BotResolveSource = 'target' | 'destination' | 'env'

export interface BotResolveResult {
  ok: boolean
  source?: BotResolveSource
  /** معرّف سجل البوت (null لمسار env). */
  botId?: string | null
  /** التوكن الصريح للإرسال — داخلي فقط. */
  token?: string | null
  error?: string
}

/**
 * حلّ توكن الإرسال لهدف واحد. لا يرمي — الفشل يعود ضمن النتيجة.
 */
export async function resolveTargetBot(input: {
  targetBotId?: string | null
  destinationBotId?: string | null
}): Promise<BotResolveResult> {
  const tryBotId = input.targetBotId ?? input.destinationBotId ?? null
  const source: BotResolveSource = input.targetBotId
    ? 'target'
    : input.destinationBotId
      ? 'destination'
      : 'env'

  if (tryBotId) {
    const bot = await db.socialTelegramBot.findUnique({
      where: { id: tryBotId },
      select: { id: true, status: true, tokenEnc: true },
    })
    if (!bot) {
      return { ok: false, error: 'البوت المُسنَد غير موجود — أعد الإسناد من إدارة الوجهات' }
    }
    if (bot.status !== 'active') {
      return { ok: false, error: 'البوت المُسنَد غير نشط — فعّله أو أسند بوتاً آخر' }
    }
    try {
      return { ok: true, source, botId: bot.id, token: decryptBotToken(bot.tokenEnc) }
    } catch {
      return { ok: false, error: 'تعذّر فك تشفير توكن البوت — أعد إدخاله من إدارة البوتات' }
    }
  }

  const envToken = process.env.TELEGRAM_BOT_TOKEN || null
  if (!envToken) {
    return { ok: false, error: 'لا بوت مسند ولا TELEGRAM_BOT_TOKEN — أسند بوتاً أولاً' }
  }
  return { ok: true, source: 'env', botId: null, token: envToken }
}

/** بصمة غير عكسية للتوكن تُستخدم مفتاحاً لعدادات الخنق (لا التوكن نفسه). */
export function botTokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16)
}

// ===== الخنق لكل بوت (سقف تليجرام ~30 رسالة/ثانية) =====
// إرسالات المحرك متسلسلة أصلاً؛ هذا يضمن تباعداً أدنى لكل بوت حتى لو
// استُدعي المحرك من مسارين. في الذاكرة (best-effort عبر النسخ).

const lastSentAt = new Map<string, number>()

/**
 * انتظر حتى انقضاء spacingMs منذ آخر إرسال لهذا البوت. الافتراضي
 * 100ms ⇒ ≤10 إرسالات/ثانية للبوت الواحد — بهامش آمن تحت سقف 30.
 */
export async function throttleBotSend(fingerprint: string, spacingMs = 100): Promise<void> {
  const now = Date.now()
  const last = lastSentAt.get(fingerprint) ?? 0
  const wait = last + spacingMs - now
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  lastSentAt.set(fingerprint, Date.now())
}

/** للاختبارات فقط: تصفير عدادات الخنق. */
export function resetBotThrottleForTests(): void {
  lastSentAt.clear()
}
