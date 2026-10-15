/**
 * lib/social/telegram-send.ts — طبقة الإرسال لتليجرام (متعددة الوجهات).
 *
 * تحديث المالك #2: دعم بوتات/قنوات/مجموعات/موضوعات متعددة:
 *  - botToken مُمرَّر صراحة (من `social_telegram_bots`) أو `null`
 *    ⇒ env TELEGRAM_BOT_TOKEN (السلوك القديم كما هو).
 *  - messageThreadId اختياري (موضوع داخل مجموعة forum).
 *  - rich != null ⇒ sendRichMessage (Bot API 10.3)، وإلا sendPhoto/sendMessage.
 *
 * لا يقرأ من قاعدة البيانات ولا يفكّ تشفيراً — المستدعي يحقن الهدف جاهزاً
 * (فصل الاختبار، ولن يصل التوكن إلى أي استجابة API).
 */

import type { InputRichMessage } from './tg-rich'

const TELEGRAM_API = 'https://api.telegram.org/bot'

export interface TelegramSendTarget {
  chatId: string
  /** `null` ⇒ env TELEGRAM_BOT_TOKEN (البوت الافتراضي). */
  botToken?: string | null
  /** موضوع داخل مجموعة forum — يُرسل فقط عند الوجود. */
  messageThreadId?: number | null
}

export interface TelegramSendInput {
  target: TelegramSendTarget
  text: string
  /** `null`/`undefined` ⇒ بلا parse_mode (نص عادي). */
  parseMode?: 'HTML' | null
  photoUrl?: string | null
  /** موجود ⇒ sendRichMessage (يتجاوز النص/الصورة الكلاسيكية). */
  rich?: InputRichMessage | null
  disableNotification?: boolean
  protectContent?: boolean
}

export type TelegramSendMethod = 'sendRichMessage' | 'sendPhoto' | 'sendMessage'

export interface TelegramSendResult {
  ok: boolean
  method: TelegramSendMethod
  messageId?: number
  error?: string
}

interface TelegramApiResponse {
  ok: boolean
  result?: { message_id?: number }
  description?: string
  error_code?: number
}

function resolveBotToken(token: string | null | undefined): string | null {
  return token && token.length > 0 ? token : process.env.TELEGRAM_BOT_TOKEN || null
}

/** بناء جسم الطلب — منفصل كي يُختبر بلا شبكة. */
export function buildTelegramPayload(input: TelegramSendInput): Record<string, unknown> {
  const { target, text, parseMode, photoUrl, rich, disableNotification, protectContent } = input

  const base: Record<string, unknown> = { chat_id: target.chatId }
  if (target.messageThreadId != null && Number.isFinite(target.messageThreadId)) {
    base.message_thread_id = target.messageThreadId
  }
  if (disableNotification != null) base.disable_notification = disableNotification
  if (protectContent != null) base.protect_content = protectContent

  if (rich) {
    return { ...base, rich_message: rich }
  }
  if (photoUrl) {
    // حد التعليق الرسمي مع الوسائط = 1024.
    return {
      ...base,
      photo: photoUrl,
      caption: text.slice(0, 1024),
      ...(parseMode ? { parse_mode: parseMode } : {}),
    }
  }
  return {
    ...base,
    text,
    ...(parseMode ? { parse_mode: parseMode } : {}),
    disable_web_page_preview: true,
  }
}

/** اسم الطريقة المطابقة لجسم الطلب. */
export function resolveTelegramMethod(input: TelegramSendInput): TelegramSendMethod {
  if (input.rich) return 'sendRichMessage'
  if (input.photoUrl) return 'sendPhoto'
  return 'sendMessage'
}

async function apiCall(
  method: TelegramSendMethod,
  token: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResponse> {
  const run = () =>
    fetch(`${TELEGRAM_API}${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  try {
    // نفس نمط lib/telegram-bot.ts: سياسة cockatiel اختيارية (ESM-only
    // يكسر تحويل Jest)، وأي فشل في الاستيراد/الشبكة يرجع { ok:false }.
    let res: Response
    try {
      const { telegramPolicy } = await import('@/lib/resilience/policies')
      res = await telegramPolicy.execute(run)
    } catch {
      res = await run()
    }
    return (await res.json()) as TelegramApiResponse
  } catch (err) {
    const { reportError } = await import('@/lib/error-reporting').catch(() => ({
      reportError: () => 'skipped' as const,
    }))
    reportError(err, { route: `social-telegram:${method}` })
    return { ok: false, description: String(err) }
  }
}

/**
 * إرسال منشور إلى هدف تليجرام واحد. لا يرمي — الفشل يعود ضمن النتيجة.
 */
export async function sendTelegramPost(input: TelegramSendInput): Promise<TelegramSendResult> {
  const method = resolveTelegramMethod(input)
  const token = resolveBotToken(input.target.botToken)
  if (!token) {
    return {
      ok: false,
      method,
      error: 'لا يوجد توكن بوت: عيّن TELEGRAM_BOT_TOKEN أو اربط المنشور ببوت مسجّل',
    }
  }

  const body = buildTelegramPayload(input)
  const result = await apiCall(method, token, body)

  if (!result.ok) {
    const description = result.description ?? 'خطأ غير معروف من تليجرام'
    return {
      ok: false,
      method,
      error: result.error_code ? `${description} (code ${result.error_code})` : description,
    }
  }

  const messageId =
    typeof result.result?.message_id === 'number' ? result.result.message_id : undefined
  return { ok: true, method, messageId }
}
