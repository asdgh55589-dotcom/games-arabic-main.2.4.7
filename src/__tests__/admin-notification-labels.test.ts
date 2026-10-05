import {
  AR_LOCALE,
  CHANNEL_LABELS,
  CHANNEL_ORDER,
  DELIVERY_STATUS,
  JOB_STATUS,
  NOT_AVAILABLE_LABEL,
  SCHEDULER_STATUS,
  UNKNOWN_CHANNEL_LABEL,
  channelLabel,
  formatArDate,
  formatArDateTime,
  formatArNumber,
  formatArTime,
  formatPercent,
  growthPercent,
  isAdminChannel,
  percentOrNotAvailable,
  statusMeta,
  toDateInputValue,
} from '@/lib/notifications/admin-labels'

/**
 * P4 — shared admin notification labels/formatters.
 *
 * The point of the shared module is that every admin page renders channels,
 * statuses and dates the same way, and that an unmapped value degrades to a
 * readable string instead of `undefined`. These tests pin the fallback rules
 * and the ar-SA wiring.
 *
 * Date assertions compare against a reference `Intl` call rather than literal
 * glyphs: ar-SA output uses Arabic-Indic digits and bidi marks whose exact
 * codepoints differ between ICU versions, but the wiring must not.
 */

const REF_DATE = '2026-10-05T08:59:02Z'

describe('channel labels — one shared map', () => {
  it('labels exactly the three canonical channels', () => {
    expect(CHANNEL_ORDER).toEqual(['in_app', 'email', 'telegram'])
    for (const channel of CHANNEL_ORDER) {
      expect(CHANNEL_LABELS[channel]).toBeTruthy()
    }
  })

  it('never shows a raw channel key to the operator', () => {
    expect(channelLabel('in_app')).toBe('داخل التطبيق')
    expect(channelLabel('email')).toBe('البريد الإلكتروني')
    expect(channelLabel('telegram')).toBe('تيليجرام')
    // Previously the templates table rendered `t.channel` raw.
    expect(channelLabel('email')).not.toBe('email')
  })

  it('falls back for unknown and missing channels', () => {
    expect(channelLabel('carrier_pigeon')).toBe('carrier_pigeon')
    expect(channelLabel('')).toBe(UNKNOWN_CHANNEL_LABEL)
    expect(channelLabel(null)).toBe(UNKNOWN_CHANNEL_LABEL)
    expect(channelLabel(undefined)).toBe(UNKNOWN_CHANNEL_LABEL)
  })

  it('narrows canonical channels only', () => {
    expect(isAdminChannel('email')).toBe(true)
    expect(isAdminChannel('sms')).toBe(false)
  })
})

describe('statusMeta — no undefined badges', () => {
  it('maps every known delivery status', () => {
    for (const key of ['sent', 'failed', 'pending', 'processing']) {
      const meta = statusMeta(key, DELIVERY_STATUS)
      expect(meta.label).toBeTruthy()
      expect(meta.className).toBeTruthy()
    }
  })

  it('maps every known job status, including dead_letter', () => {
    for (const key of ['pending', 'processing', 'sent', 'failed', 'dead_letter']) {
      expect(statusMeta(key, JOB_STATUS).label).toBeTruthy()
    }
  })

  it('maps every known scheduler status', () => {
    for (const key of ['pending', 'running', 'completed', 'failed']) {
      expect(statusMeta(key, SCHEDULER_STATUS).label).toBeTruthy()
    }
  })

  it('degrades to a neutral badge for an unknown status instead of undefined', () => {
    // The history table used `${STATUS_COLORS[log.status]}` with no fallback,
    // which rendered `undefined` as a class and an empty label.
    const meta = statusMeta('teleported', DELIVERY_STATUS)
    expect(meta.label).toBe('teleported')
    expect(meta.className).toContain('bg-muted')
    expect(meta.className).not.toContain('undefined')
  })

  it('degrades to a neutral badge for a missing status', () => {
    const meta = statusMeta(undefined, DELIVERY_STATUS)
    expect(meta.label).toBeTruthy()
    expect(meta.label).not.toBe('undefined')
    expect(meta.className).not.toContain('undefined')
  })
})

describe('ar-SA date formatting', () => {
  it('formats dates with the ar-SA reference formatter', () => {
    const expected = new Intl.DateTimeFormat(AR_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(REF_DATE))
    expect(formatArDate(REF_DATE)).toBe(expected)
  })

  it('formats date-times with the ar-SA reference formatter', () => {
    const expected = new Intl.DateTimeFormat(AR_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(REF_DATE))
    expect(formatArDateTime(REF_DATE)).toBe(expected)
  })

  it('formats the refresh stamp with the ar-SA reference formatter', () => {
    const expected = new Intl.DateTimeFormat(AR_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(REF_DATE))
    expect(formatArTime(REF_DATE)).toBe(expected)
  })

  it('uses Arabic-Indic digits, never Latin ones', () => {
    expect(formatArDate(REF_DATE)).toMatch(/[٠-٩]/)
    expect(formatArDate(REF_DATE)).not.toMatch(/[0-9]/)
  })

  it('renders an em dash for missing or unparseable input', () => {
    for (const bad of [null, undefined, '', 'not-a-date']) {
      expect(formatArDate(bad)).toBe('—')
      expect(formatArDateTime(bad)).toBe('—')
      expect(formatArTime(bad)).toBe('—')
    }
  })

  it('builds a date-input value in UTC so it never shifts a day', () => {
    // 23:30 UTC is already the next day in some zones; slicing the local
    // string would move the filter by a day.
    expect(toDateInputValue(new Date('2026-10-05T23:30:00Z'))).toBe('2026-10-05')
  })
})

describe('numbers and percentages', () => {
  it('formats integers with the ar-SA reference formatter', () => {
    const expected = new Intl.NumberFormat(AR_LOCALE, {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(2189)
    expect(formatArNumber(2189)).toBe(expected)
  })

  it('never emits NaN for a non-finite counter', () => {
    expect(formatArNumber(Number.NaN)).toBe('—')
    expect(formatArNumber(Number.POSITIVE_INFINITY)).toBe('—')
    expect(formatArNumber(null)).toBe('—')
  })

  it('computes a percentage against a real baseline', () => {
    const pct = formatPercent(9, 45)
    const expected = new Intl.NumberFormat(AR_LOCALE, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(20)
    expect(pct).toBe(expected)
  })

  it('reports n/a rather than NaN% or a fake 0% when the baseline is zero', () => {
    // The analytics growth badges used `Math.abs(NaN).toFixed(1)` → "NaN%".
    for (const zero of [0, null, undefined]) {
      expect(percentOrNotAvailable(formatPercent(9, zero))).toBe(NOT_AVAILABLE_LABEL)
    }
    expect(percentOrNotAvailable(null)).toBe(NOT_AVAILABLE_LABEL)
    expect(percentOrNotAvailable(formatPercent(0, 0))).toBe(NOT_AVAILABLE_LABEL)
  })

  it('never returns a literal NaN from the percent helper', () => {
    expect(formatPercent(1, 0)).toBeNull()
    expect(formatPercent(Number.NaN, 10)).toBeNull()
    expect(formatPercent(10, Number.NaN)).toBeNull()
  })
})

describe('growthPercent — honest empty baseline', () => {
  it('computes signed growth against a non-zero baseline', () => {
    expect(growthPercent(150, 100)).toBeCloseTo(50)
    expect(growthPercent(50, 100)).toBeCloseTo(-50)
    expect(growthPercent(100, 100)).toBeCloseTo(0)
    // Falling to zero is a full decline, not "no change".
    expect(growthPercent(0, 100)).toBeCloseTo(-100)
  })

  it('returns null when the previous period was empty', () => {
    // 0 → 50 is not "+Infinity%"; the baseline has to read as n/a.
    expect(growthPercent(50, 0)).toBeNull()
    expect(growthPercent(0, 0)).toBeNull()
    expect(growthPercent(50, null)).toBeNull()
    expect(growthPercent(null, 100)).toBeNull()
    expect(growthPercent(50, Number.NaN)).toBeNull()
  })
})
