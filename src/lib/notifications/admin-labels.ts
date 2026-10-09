/**
 * Shared labels, status maps and ar-SA formatters for the admin notification
 * surfaces (`/admin/notifications/*`, `/admin/notifications-health`,
 * `/admin/scheduler`, `/admin/templates`).
 *
 * Every admin page previously carried its own local copy of the channel and
 * status maps, which is how the channel labels drifted apart (raw `in_app`
 * keys in the templates table, `ar-EG` dates in analytics, missing fallbacks
 * that rendered `undefined` badges). One map, one fallback rule, one locale.
 *
 * Pure module: no React, no JSX — safe to import from server code and jest.
 */

/** Canonical channel order. Also the column order of the coverage matrix. */
export const CHANNEL_ORDER = ['in_app', 'email', 'telegram'] as const

export type AdminChannel = (typeof CHANNEL_ORDER)[number]

/**
 * The single source of truth for channel names in the admin UI.
 * `channelLabel()` is the only thing pages should call.
 */
export const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'داخل التطبيق',
  email: 'البريد الإلكتروني',
  telegram: 'تيليجرام',
}

/** Never render a raw key: unknown channels degrade to a readable placeholder. */
export const UNKNOWN_CHANNEL_LABEL = 'قناة غير معروفة'

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return UNKNOWN_CHANNEL_LABEL
  return CHANNEL_LABELS[channel] ?? channel
}

export function isAdminChannel(value: string): value is AdminChannel {
  return (CHANNEL_ORDER as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

export interface StatusMeta {
  label: string
  /** Tailwind classes for the badge. Never empty — see `statusMeta`. */
  className: string
}

const NEUTRAL_STATUS: StatusMeta = {
  label: 'حالة غير معروفة',
  className: 'bg-muted text-muted-foreground',
}

/**
 * `NotificationLog.status` — the per-channel delivery outcome rendered in the
 * history table.
 */
export const DELIVERY_STATUS: Record<string, StatusMeta> = {
  sent: { label: 'مرسل', className: 'bg-green-100 text-green-700' },
  failed: { label: 'فشل', className: 'bg-red-100 text-red-700' },
  pending: { label: 'معلق', className: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'قيد المعالجة', className: 'bg-blue-100 text-blue-700' },
  queued: { label: 'في الانتظار', className: 'bg-yellow-100 text-yellow-700' },
}

/**
 * `NotificationJob.status` — queue state, used by the health page. Distinct
 * from delivery status: a job that is still `pending` has no `NotificationLog`
 * row yet, and `dead_letter` has no delivery status equivalent.
 */
export const JOB_STATUS: Record<string, StatusMeta> = {
  pending: { label: 'معلق', className: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'قيد المعالجة', className: 'bg-blue-100 text-blue-700' },
  sent: { label: 'تم الإرسال', className: 'bg-green-100 text-green-700' },
  failed: { label: 'فشل', className: 'bg-red-100 text-red-700' },
  dead_letter: { label: 'رسالة ميتة', className: 'bg-red-200 text-red-800' },
}

/** `ScheduledJob.status` — the scheduler page. */
export const SCHEDULER_STATUS: Record<string, StatusMeta> = {
  pending: { label: 'معلق', className: 'bg-yellow-100 text-yellow-700' },
  running: { label: 'قيد التنفيذ', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'مكتمل', className: 'bg-green-100 text-green-700' },
  failed: { label: 'فشل', className: 'bg-red-100 text-red-700' },
}

/** Circuit-breaker state, rendered as text on the health page. */
export const CIRCUIT_BREAKER_LABELS: Record<string, string> = {
  closed: 'مغلق (خدمة سليمة)',
  open: 'مفتوح (الخدمة متوقفة)',
  half_open: 'نصف مفتوح (اختبار)',
  'half-open': 'نصف مفتوح (اختبار)',
}

/**
 * Look up a status badge. Unknown or missing statuses get a neutral badge
 * instead of `undefined` — an unmapped status must never produce a blank pill
 * or an unstyled `undefined` class attribute.
 */
export function statusMeta(
  status: string | null | undefined,
  map: Record<string, StatusMeta>,
): StatusMeta {
  if (!status) return NEUTRAL_STATUS
  return map[status] ?? { label: status, className: NEUTRAL_STATUS.className }
}

// ---------------------------------------------------------------------------
// ar-SA formatting
// ---------------------------------------------------------------------------

/** Every admin surface formats dates with this locale — not `ar`/`ar-EG`. */
export const AR_LOCALE = 'ar-SA'

const EM_DASH = '—'

/** `2026-10-05T08:59:02Z` → `05/10/2026`. Renders an em dash when absent/invalid. */
export function formatArDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return EM_DASH
  return new Intl.DateTimeFormat(AR_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** `2026-10-05T08:59:02Z` → `05/10/2026، 08:59 ص`. */
export function formatArDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return EM_DASH
  return new Intl.DateTimeFormat(AR_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Time only — used for the health page's "last refreshed" stamp. */
export function formatArTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return EM_DASH
  return new Intl.DateTimeFormat(AR_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

/**
 * `<input type="date">` value (`YYYY-MM-DD`) from a Date, for date filters.
 * Uses UTC so the value never shifts a day across timezones.
 */
export function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Arabic-Indic digits for counters. Guards non-finite values, which is what
 * produced `NaN%` on the analytics growth badges when the baseline was empty.
 */
export function formatArNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(AR_LOCALE, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value)
}

/**
 * Percentage that degrades honestly instead of to `NaN%` or a fake `0%`.
 * Returns `null` when there is no baseline to divide by, so callers can show
 * `غير متاح` ("n/a").
 */
export function formatPercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  fractionDigits = 1,
): string | null {
  if (
    numerator == null ||
    denominator == null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null
  }
  return formatArNumber((numerator / denominator) * 100, fractionDigits)
}

export const NOT_AVAILABLE_LABEL = 'غير متاح'

/** `formatPercent(...)` result rendered for display, with the n/a fallback. */
export function percentOrNotAvailable(percent: string | null): string {
  return percent ?? NOT_AVAILABLE_LABEL
}

/**
 * Signed growth between a current and a previous period.
 * Returns `null` when the previous period was empty — growth against zero is
 * undefined (0 → 50 is not "+∞%"), and an empty baseline must read as n/a.
 */
export function growthPercent(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (
    current == null ||
    previous == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null
  }
  return ((current - previous) / previous) * 100
}
