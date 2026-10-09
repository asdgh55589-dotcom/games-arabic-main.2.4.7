/**
 * lib/notifications/pipeline.ts — دوال خط أنابيب الإشعارات (P2)
 *
 * دوال "نقية" مشتركة بين الكاتب (service.ts) وعامل التصريف (drain.ts):
 *  - بناء متغيرات القالب من صف إشعار
 *  - بناء محتوى القناة (بريد HTML بتغليف + بيكسل تتبع logId / تليغرام)
 *  - نوافذ منع التكرار (من سياسة domain المشتركة)
 *  - ترميز/فك مؤشر استئناف التصريف
 *
 * لا يقرأ هذا الملف قاعدة البيانات ولا يرسل شيئاً — الاختبارات الوحدوية
 * تغطيه مباشرة.
 */

import { DEFAULT_DEDUPLICATION_CONFIG } from '@/domain/policies/deduplication-policy'
import { generateEmailWrapper } from '@/infrastructure/templates/email-base'
import { escapeTelegramHtml } from '@/lib/telegram-notifications'

/** الحد الأدنى والأقصى لدفعة التصريف في كل استدعاء cron. */
export const DRAIN_DEFAULT_LIMIT = 25
export const DRAIN_MAX_LIMIT = 100
/** المهلة الافتراضية لدفعة واحدة (يجب أن تبقى تحت حد زمن دالة Vercel). */
export const DRAIN_DEFAULT_DEADLINE_MS = 25_000

export interface NotificationContentSource {
  type: string
  title: string
  message: string
  /** بيانات الحدث الخام (Json من Prisma) — تُطبَّع هنا قبل التمرير للقالب. */
  data?: unknown
  targetUrl?: string | null
  targetTitle?: string | null
  targetSlug?: string | null
  actorUsername?: string | null
}

export interface NotificationRecipientInfo {
  username?: string | null
  displayName?: string | null
}

/**
 * متغيرات القالب الموحدة — نفس المجموعة لكل القنوات حتى لا يختلف
 * المعنى بين داخل التطبيق والبريد وTelegram.
 */
export function buildVariables(
  source: NotificationContentSource,
  recipient: NotificationRecipientInfo = {},
): Record<string, unknown> {
  const raw = source.data
  const data: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    actorName: source.actorUsername ?? '',
    actorUsername: source.actorUsername ?? '',
    recipientName: recipient.displayName || recipient.username || '',
    username: recipient.username || '',
    modName: data.modName ?? '',
    modTitle: data.modTitle ?? data.modName ?? '',
    teamName: data.teamName ?? '',
    targetTitle: source.targetTitle ?? '',
    targetUrl: source.targetUrl ?? '',
    appUrl: siteBase(),
    ...data,
  }
}

/** عنوان البريد — قالب قناة email يوفّر عادةً subject جاهزاً. */
export function buildEmailSubject(title: string): string {
  return title.trim() || 'إشعار من منصة تعريب الألعاب'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * جسم البريد: قوالب channel='email' المزروعة تُخرج HTML جاهزاً (تبدأ بـ
 * `<div dir="rtl">`)، بينما النص الاحتياطي نص خام قد يحمل مدخلات المستخدم
 * — لذلك لا يُعدّ "HTML" إلا ما بدأ بوسم آمن، وما بدأ بوسم خطير يُهرَّب دائماً.
 */
export function toEmailBody(message: string): string {
  const trimmed = message.trim()
  const startsWithTag = /^\s*<[a-z][^>]*>/i.test(trimmed)
  const dangerous = /^\s*<(script|style|iframe|object|embed|link|meta)\b/i.test(trimmed)
  if (startsWithTag && !dangerous) return trimmed
  return `<p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.7;">${escapeHtml(
    trimmed,
  ).replace(/\n/g, '<br>')}</p>`
}

/** قاعدة الموقع المطلقة لروابط التتبع (نفس ترتيب env في بقية المشروع). */
export function siteBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(
    /\/$/,
    '',
  )
}

/**
 * رابط إعادة توجيه التتبع يمرّ عبر /api/notifications/track لتسجيل
 * الضغط على `logId` الخاص بصف سجل هذا الإرسال.
 * يُلفّ فقط الروابط الداخلية حتى لا يتحوّل مسار التتبع إلى فتحة
 * إعادة توجيه مفتوحة.
 */
export function withClickTracking(url: string | undefined, logId: string): string {
  const raw = (url ?? '').trim()
  if (!raw || !isTrackableUrl(raw)) return raw
  const base = siteBase()
  if (!base) return raw
  const target = raw.startsWith('/') ? `${base}${raw}` : raw
  return `${base}/api/notifications/track?id=${encodeURIComponent(logId)}&event=click&url=${encodeURIComponent(target)}`
}

function isTrackableUrl(url: string): boolean {
  if (url.startsWith('/')) return true
  const base = siteBase()
  return Boolean(base && url.startsWith(`${base}/`))
}

/** غلاف بريد RTL مع بيكسل التتبع — يمرّر logId حتى يُفتح `openedAt`. */
export function buildEmailHtml(params: {
  subject: string
  body: string
  recipientName?: string
  actionUrl?: string
  actionLabel?: string
  /** غيابه (بيئة بلا NEXT_PUBLIC_APP_URL) ⇒ لا بيكسل، والرسالة تُرسل بلا تتبع. */
  logId?: string
}): string {
  return generateEmailWrapper({
    title: params.subject,
    body: toEmailBody(params.body),
    recipientName: params.recipientName,
    actionUrl: params.actionUrl,
    actionLabel: params.actionLabel,
    logId: params.logId,
  })
}

/** نسخة نصية خام لجهات احتياطية (text/plain) في رسالة البريد. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * نص تليغرام (parse mode HTML). كل محتوى المستخدم يمرّ عبر الهروب —
 * Telegram يعرض <b>/<a> فقط ويرفض أي وسم غير معروف.
 */
export function buildTelegramText(params: {
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
}): string {
  const title = escapeTelegramHtml(params.title.trim())
  const message = escapeTelegramHtml(params.message.trim())
  const chunks = [title ? `<b>${title}</b>` : '', message].filter(Boolean)
  const url = (params.actionUrl ?? '').trim()
  if (url) {
    const label = escapeTelegramHtml(params.actionLabel || 'عرض التفاصيل')
    chunks.push(`<a href="${escapeTelegramHtml(url)}">${label}</a>`)
  }
  return chunks.join('\n\n').slice(0, 4000)
}

/**
 * نافذة منع التكرار (بالدقائق) لنوع إشعار — من إعدادات domain
 * المشتركة. الأنواع غير المذكورة = 0 (لا منع تكرار).
 */
export function dedupWindowMinutes(type: string): number {
  const windows = DEFAULT_DEDUPLICATION_CONFIG.windowMinutes as Record<string, number>
  return windows[type] ?? 0
}

/** لحظة بداية نافذة منع التكرار بالنسبة للحظة `now`. */
export function dedupCutoff(now: Date, windowMinutes: number): Date {
  return new Date(now.getTime() - windowMinutes * 60_000)
}

/** هل هذه القناة مفعّلة في التفضيلات (عام + خاص بالنوع)؟ */
export function isChannelEnabled(
  preferences: {
    emailEnabled?: boolean
    pushEnabled?: boolean
    typePreferences?: unknown
  } | null,
  channel: 'in_app' | 'email' | 'telegram',
  type: string,
): boolean {
  if (!preferences) return true
  if (channel === 'email' && preferences.emailEnabled === false) return false
  if (channel === 'in_app' && preferences.pushEnabled === false) return false

  const typePreferences = (preferences.typePreferences ?? {}) as Record<
    string,
    { enabled?: boolean; emailEnabled?: boolean; pushEnabled?: boolean } | undefined
  >
  const override = typePreferences[type]
  if (!override) return true
  if (override.enabled === false) return false
  if (channel === 'email' && override.emailEnabled === false) return false
  if (channel === 'in_app' && override.pushEnabled === false) return false
  return true
}

export interface DrainCursor {
  scheduledFor: number
  id: string
}

/**
 * مؤشر استئناف التصريف: دفعة تنتهي بـ hasMore=true تُرجعه، و_invocation
 * التالي يستأنف من بعده بدل إعادة مسح الطابور من أوله.
 */
export function encodeDrainCursor(cursor: DrainCursor): string {
  return `${cursor.scheduledFor}:${cursor.id}`
}

export function parseDrainCursor(raw: string | null | undefined): DrainCursor | null {
  if (!raw) return null
  const sep = raw.indexOf(':')
  if (sep <= 0) return null
  const scheduledFor = Number(raw.slice(0, sep))
  const id = raw.slice(sep + 1)
  if (!Number.isFinite(scheduledFor) || !id) return null
  return { scheduledFor, id }
}
