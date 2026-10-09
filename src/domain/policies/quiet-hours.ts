/**
 * Quiet hours — سياسة ساعات الهدوء (نقية بالكامل)
 *
 * مشتركة بين الطابقين معاً حتى لا يختلف معنى "ساعات الهدوء" بحسب
 * المسار الذي أنشأ الإشعار:
 *  - الكيان domain/entities/notification-preference (مسار use-cases)
 *  - كاتب الإشعارات lib/notifications + عامل التصريف (drain)
 *
 * القاعدة: النافذة تُحسب في المنطقة الزمنية للمستلم (IANA) — لا في
 * منطقة زمنية الخادم. قبل P2 كان الكود يستخدم `date.getHours()` أي
 * توقيت عملية الخادم (UTC على Vercel) فكانت النافذة خاطئة دائماً.
 *
 * لا يقرأ هذا الملف قاعدة بيانات ولا شبكة — فقط Intl ووقت النظام.
 */

export interface QuietHoursWindow {
  /** منطقة IANA للمستلم، مثال "Asia/Riyadh". null/غير صالح ⇒ UTC. */
  timezone?: string | null
  quietHoursEnabled: boolean
  /** "HH:MM" (يُقبل أيضاً "H" من الصفوف القديمة). */
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
}

/** الافتراضيات التاريخية للكود القديم: 22:00 → 08:00. */
export const DEFAULT_QUIET_HOURS_START = '22:00'
export const DEFAULT_QUIET_HOURS_END = '08:00'

/** هل تدعم بيئة Node/المتصفح هذه المنطقة الزمنية المطلوبة؟ */
export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * المنطقة الزمنية التي تُحسب بها النافذة.
 * أي قيمة غير صالحة (عمود فارغ، مدخل يدوي خاطئ) ترجع إلى UTC — وهو
 * سلوك الخادم قبل P2، فلا يتغير شيء لمن لم يُدخل منطقته بعد.
 */
export function resolveQuietHoursTimezone(timezone?: string | null): string {
  const candidate = (timezone ?? '').trim()
  if (candidate && isValidTimezone(candidate)) return candidate
  return 'UTC'
}

/** "HH:MM" أو "H" → دقائق منذ منتصف الليل. غير صالح ⇒ null. */
export function parseClock(value: string | null | undefined): number | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const m = /^([01]?\d|2[0-3])(?::([0-5]\d))?$/.exec(raw)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2] ?? '0')
}

interface WallClock {
  year: number
  month: number
  day: number
  minutes: number
}

function wallClock(date: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  const hour = get('hour')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Intl قد يُرجع 24 لمنتصف الليل في بعض المحركات.
    minutes: (hour % 24) * 60 + get('minute'),
  }
}

/**
 * إزاحة المنطقة الزمنية (بالمللي ثانية) بلحظة `date`:
 * offset = الساعة الجدارية المحلية − UTC.
 */
function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtc - date.getTime()
}

/** ساعة جدارية في منطقة زمنية → لحظة UTC مكافئة (تصحيحان يكفيان لـ DST). */
function wallClockToUtc(
  year: number,
  month: number,
  day: number,
  minutesOfDay: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, 0, minutesOfDay, 0)
  let ts = target - timezoneOffsetMs(new Date(target), timeZone)
  ts = target - timezoneOffsetMs(new Date(ts), timeZone)
  return new Date(ts)
}

/**
 * هل نحن داخل ساعات الهدوء الآن؟
 * النطاق الذي يعبر منتصف الليل (22:00 → 08:00) يُعامَل كنطاقين.
 */
export function isWithinQuietHours(now: Date, window: QuietHoursWindow): boolean {
  if (!window.quietHoursEnabled) return false
  const start = parseClock(window.quietHoursStart) ?? parseClock(DEFAULT_QUIET_HOURS_START)
  const end = parseClock(window.quietHoursEnd) ?? parseClock(DEFAULT_QUIET_HOURS_END)
  if (start === null || end === null || start === end) return false

  const current = wallClock(now, resolveQuietHoursTimezone(window.timezone)).minutes
  if (start < end) return current >= start && current < end
  return current >= start || current < end
}

/**
 * اللحظة التالية التي تنتهي فيها ساعات الهدوء (بتوقيت المستلم).
 * تُستخدم لتأجيل مهمة بريد/تليغرام بدل ضياعها.
 */
export function nextQuietHoursEnd(now: Date, window: QuietHoursWindow): Date {
  const timeZone = resolveQuietHoursTimezone(window.timezone)
  const end = parseClock(window.quietHoursEnd) ?? parseClock(DEFAULT_QUIET_HOURS_END) ?? 0
  const local = wallClock(now, timeZone)
  const today = wallClockToUtc(local.year, local.month, local.day, end, timeZone)
  if (today.getTime() > now.getTime()) return today
  const tomorrow = wallClockToUtc(local.year, local.month, local.day + 1, end, timeZone)
  return tomorrow.getTime() > now.getTime() ? tomorrow : today
}
