/**
 * lib/telegram-destinations.ts — التحقق من وجهات إرسال Telegram (المرحلة 1)
 *
 * دوال نقية بالكامل: لا قاعدة بيانات، لا شبكة، ولا إرسال رسائل إطلاقاً.
 * المرحلة 1 تقتصر على الحفظ (schema + migration + هذه الدوال) — أي إرسال
 * فعلي يأتي في مرحلة لاحقة وعلى مسار إذن منفصل (البث يبقى manager-only).
 *
 * قيود ملزمة:
 *  - كل أنواع المحادثات مؤهلة (channel | group | supergroup | private | bot):
 *    لا قوائم سوداء ولا فلترة نوع.
 *  - النصوص القديمة في lib/telegram-templates.ts لم تُمسّ — هذه الملف مستقل.
 *  - ميزات الدفع تبقى معطّلة: لا يضيف هذا الملف أي رسالة مدفوعة أو رسالة
 *    نصية عادية/غنية تُرسَل — الدوال تتحقق فقط.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** أنواع المحادثات التي تُقبل كوجهة — الكل مؤهل، بلا استثناء. */
export const TELEGRAM_CHAT_TYPES = [
  'channel',
  'group',
  'supergroup',
  'private',
  'bot',
  'unknown',
] as const
export type TelegramChatType = (typeof TELEGRAM_CHAT_TYPES)[number]

/** حالة السجل في جدول telegram_destinations. */
export const TELEGRAM_DESTINATION_STATUSES = ['pending', 'active', 'disabled'] as const
export type TelegramDestinationStatus = (typeof TELEGRAM_DESTINATION_STATUSES)[number]

/** حالة التحقق من الوجهة. */
export const TELEGRAM_VERIFICATION_STATUSES = ['unverified', 'verified', 'failed'] as const
export type TelegramVerificationStatus = (typeof TELEGRAM_VERIFICATION_STATUSES)[number]

/** أقصى طول للمُعرِّف (رقم المحادثة أو @handle) بعد الطباعة. */
export const TELEGRAM_DESTINATION_MAX_LENGTH = 64

/** حدود رمز التحقق: ساعة واحدة افتراضياً كي لا يعيش الرمز إلى ما لا نهاية. */
export const DESTINATION_TOKEN_DEFAULT_MAX_AGE_MS = 60 * 60 * 1000

/** username على Telegram: 5–32 رمزاً، يبدأ بحرف، ويقبل أرقاماً وشرطة سفلية. */
const TELEGRAM_USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/
/** رقم محادثة: أرقام فقط (بلا إشارة) أو بإشارة سالبة/موجبة. */
const TELEGRAM_CHAT_ID_RE = /^[+-]?\d{1,20}$/

export type DestinationParseFailure = 'empty' | 'too_long' | 'invalid_chat_id' | 'invalid_username'

export interface ParsedDestinationRef {
  /** القيمة كما أُدخلت (بعد trim). */
  raw: string
  /** الصيغة الموحّدة: "-1001234" أو "@handle". */
  canonical: string
  kind: 'chat_id' | 'username'
  /** نوع مستنتج محلياً — "unknown" حين يحتاج استعلاماً من Telegram لاحقاً. */
  chatType: TelegramChatType
  /** @handle بلا "@" إن وُجد. */
  username?: string
}

export type ParseDestinationResult =
  | { ok: true; ref: ParsedDestinationRef }
  | { ok: false; reason: DestinationParseFailure }

/**
 * تصنيف رقم محادثة من صيغته فقط (بلا استعلام).
 *
 * القيود المعروفة في Telegram:
 *  - أرقام موجبة  ⇒ مستخدم/بوت (private | bot — لا يمكن التفريق بلا استعلام).
 *  - "-100…"      ⇒ supergroup أو channel (كلاهما يبدأ بـ -100).
 *  - سالب غير ذلك ⇒ group.
 * التصنيف إرشادي فقط؛ "all types eligible" أي أن الرفض لا يحدث بسبب النوع.
 */
export function classifyTelegramChatId(chatId: string): TelegramChatType {
  if (/^-100\d+$/.test(chatId)) return 'supergroup'
  if (/^-\d+$/.test(chatId)) return 'group'
  if (/^\d+$/.test(chatId)) return 'private'
  return 'unknown'
}

/**
 * تطبيع والتحقق من مُعرِّف وجهة قبل حفظها.
 * يقبل كل الأنواع: رقم محادثة سالب/موجب أو @handle.
 */
export function parseTelegramDestination(raw: unknown): ParseDestinationResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  if (trimmed.length > TELEGRAM_DESTINATION_MAX_LENGTH) {
    return { ok: false, reason: 'too_long' }
  }

  if (trimmed.startsWith('@')) {
    const username = trimmed.slice(1)
    if (!TELEGRAM_USERNAME_RE.test(username)) {
      return { ok: false, reason: 'invalid_username' }
    }
    return {
      ok: true,
      ref: {
        raw: trimmed,
        canonical: `@${username}`,
        kind: 'username',
        chatType: 'unknown', // يحتاج استعلاماً من Telegram لمعرفة النوع الفعلي
        username,
      },
    }
  }

  if (TELEGRAM_CHAT_ID_RE.test(trimmed)) {
    const canonical = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed
    return {
      ok: true,
      ref: {
        raw: trimmed,
        canonical,
        kind: 'chat_id',
        chatType: classifyTelegramChatId(canonical),
      },
    }
  }

  return { ok: false, reason: 'invalid_chat_id' }
}

export interface DestinationTokenClaims {
  chatId: string
  /** سر التوقيع — يمرّره النادٍ (مثلاً TELEGRAM_BOT_TOKEN)؛ لا يُخزَّن هنا. */
  secret: string
  /** لحظة إصدار الرمز (epoch ms). */
  issuedAt?: number
}

export interface VerifyDestinationTokenOptions {
  chatId: string
  secret: string
  issuedAt?: number
  now?: number
  maxAgeMs?: number
}

export type VerifyDestinationTokenResult =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'mismatch' | 'expired' }

function hmacHex(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/**
 * إصدار رمز تحقق للوجهة: `${issuedAt}.${HMAC(issuedAt|chatId)}`.
 * الرمز إثبات سيطرة على الوجهة — لا يُرسل ولا يُسلَّم في المرحلة 1،
 * حفظاً للجدول فقط.
 */
export function signDestinationVerificationToken(claims: DestinationTokenClaims): string {
  const issuedAt = claims.issuedAt ?? Date.now()
  const payload = `${issuedAt}:${claims.chatId}`
  return `${issuedAt}.${hmacHex(payload, claims.secret)}`
}

/**
 * التحقق من رمز وجهة صادر عن signDestinationVerificationToken.
 * يرفض الرمز غير المطابق للوجهة أو المنتهي الصلاحية (مقارنة آمنة زمنياً).
 */
export function verifyDestinationVerificationToken(
  token: unknown,
  opts: VerifyDestinationTokenOptions,
): VerifyDestinationTokenResult {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'malformed' }
  }
  const [issuedAtRaw, signature] = token.split('.')
  const issuedAt = Number(issuedAtRaw)
  if (!Number.isFinite(issuedAt) || !signature) {
    return { ok: false, reason: 'malformed' }
  }

  const expected = hmacHex(`${issuedAt}:${opts.chatId}`, opts.secret)
  if (!safeEqualHex(signature, expected)) {
    return { ok: false, reason: 'mismatch' }
  }

  const now = opts.now ?? Date.now()
  const maxAge = opts.maxAgeMs ?? DESTINATION_TOKEN_DEFAULT_MAX_AGE_MS
  const age = now - issuedAt
  if (age < 0 || age > maxAge) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true }
}

export interface DestinationReadinessInput {
  status: string
  verificationStatus?: string | null
}

export type DestinationReadiness =
  | { ready: true; reason: 'ok' }
  | { ready: false; reason: 'disabled' | 'pending' | 'unverified' | 'failed_verification' }

/**
 * هل الوجهة جاهزة لاستقبال إرسال؟ (دالة شرط نقية — لا إرسال هنا)
 * الشروط: السجل active + التحقق verified. أي شيء آخر يُمنع.
 */
export function destinationReadiness(dest: DestinationReadinessInput): DestinationReadiness {
  if (dest.status !== 'active') {
    return { ready: false, reason: dest.status === 'disabled' ? 'disabled' : 'pending' }
  }
  if (dest.verificationStatus !== 'verified') {
    return {
      ready: false,
      reason: dest.verificationStatus === 'failed' ? 'failed_verification' : 'unverified',
    }
  }
  return { ready: true, reason: 'ok' }
}

export type DestinationThreadFailure =
  | 'not_a_forum'
  | 'unknown_type'
  | 'unconfirmed_supergroup'
  | 'invalid_thread'

/**
 * صلاحية ربط موضوع (message_thread_id) بنوع الوجهة — دالة نقية.
 * المواضيع موجودة فقط في مجموعات المنتدى (forum): عملياً supergroup،
 * ونقبل group لأن التصنيف المحلي إرشادي وقد تكون المجموعة تحوّلت.
 * القنوات/الخاص/البوتات/غير-المعروفة تُرفض برسالة عربية.
 *
 * غموض `-100`: القنوات والمجموعات الخارقة تشترك في بادئة `-100`
 * (انظر classifyTelegramChatId)، والتصنيف المحلي يخمّن supergroup.
 * لذلك لا يُقبل thread مع معرّف `-100` إلا بعد تأكيد فحص الصحة
 * (healthConfirmed) — وإلا طُلب إنشاء الوجهة بلا موضوع ثم الفحص أولاً.
 */
export function validateDestinationThread(
  chatType: string,
  messageThreadId: number | null | undefined,
  opts?: { canonicalId?: string | null; healthConfirmed?: boolean },
): { ok: true } | { ok: false; reason: DestinationThreadFailure; message: string } {
  if (messageThreadId == null) return { ok: true }
  if (!Number.isInteger(messageThreadId) || messageThreadId < 1) {
    return {
      ok: false,
      reason: 'invalid_thread',
      message: 'رقم الموضوع يجب أن يكون عدداً صحيحاً موجباً (1 للموضوع العام فأعلى)',
    }
  }
  if (chatType === 'unknown') {
    return {
      ok: false,
      reason: 'unknown_type',
      message: 'نوع الوجهة غير معروف — نفّذ فحص الصحة أولاً لمعرفة النوع الحقيقي قبل ربط موضوع',
    }
  }
  if (chatType !== 'supergroup' && chatType !== 'group') {
    return {
      ok: false,
      reason: 'not_a_forum',
      message:
        'المواضيع موجودة فقط داخل مجموعات المنتدى (supergroup) — لا تُربط بقناة أو محادثة خاصة',
    }
  }
  const canonical = (opts?.canonicalId ?? '').trim()
  if (!opts?.healthConfirmed && canonical.startsWith('-100')) {
    return {
      ok: false,
      reason: 'unconfirmed_supergroup',
      message:
        'هذا المعرّف (-100…) قد يكون قناة — أنشئ الوجهة بلا موضوع ثم نفّذ فحص الصحة، وبعد التأكد أنها مجموعة أضف الموضوع',
    }
  }
  return { ok: true }
}
