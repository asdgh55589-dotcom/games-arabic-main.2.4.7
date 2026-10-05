/**
 * سياسة ساعات الهدوء — النقية المطلقة (لا قاعدة بيانات ولا شبكة).
 *
 * الأهم هنا: النافذة تُحسب في منطقة المستلم الزمنية، لا في توقيت
 * الخادم. قبل P2 كان `date.getHours()` (توقيت العملية) هو المرجع،
 * فكانت النافذة خاطئة على Vercel (UTC).
 */

import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  isValidTimezone,
  isWithinQuietHours,
  nextQuietHoursEnd,
  parseClock,
  resolveQuietHoursTimezone,
} from '@/domain/policies/quiet-hours'

describe('isValidTimezone', () => {
  it('accepts IANA zones', () => {
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Asia/Riyadh')).toBe(true)
    expect(isValidTimezone('Pacific/Kiritimati')).toBe(true)
  })

  it('rejects junk', () => {
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
    expect(isValidTimezone('')).toBe(false)
  })
})

describe('resolveQuietHoursTimezone', () => {
  it('passes valid zones through', () => {
    expect(resolveQuietHoursTimezone('Asia/Riyadh')).toBe('Asia/Riyadh')
    expect(resolveQuietHoursTimezone('  Asia/Riyadh  ')).toBe('Asia/Riyadh')
  })

  it('falls back to UTC for missing or invalid values', () => {
    expect(resolveQuietHoursTimezone(null)).toBe('UTC')
    expect(resolveQuietHoursTimezone(undefined)).toBe('UTC')
    expect(resolveQuietHoursTimezone('Not/AZone')).toBe('UTC')
  })
})

describe('parseClock', () => {
  it('parses HH:MM and legacy H', () => {
    expect(parseClock('22:00')).toBe(22 * 60)
    expect(parseClock('07:30')).toBe(7 * 60 + 30)
    expect(parseClock('8')).toBe(8 * 60)
  })

  it('rejects out-of-range and empty values', () => {
    expect(parseClock('24:00')).toBeNull()
    expect(parseClock('22:60')).toBeNull()
    expect(parseClock('')).toBeNull()
    expect(parseClock(null)).toBeNull()
  })
})

describe('isWithinQuietHours', () => {
  const overnight = {
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: 'UTC',
  } as const

  it('is off when the switch is disabled', () => {
    expect(
      isWithinQuietHours(new Date('2026-01-15T23:00:00Z'), {
        ...overnight,
        quietHoursEnabled: false,
      }),
    ).toBe(false)
  })

  it('handles overnight windows', () => {
    expect(isWithinQuietHours(new Date('2026-01-15T23:30:00Z'), overnight)).toBe(true)
    expect(isWithinQuietHours(new Date('2026-01-15T03:00:00Z'), overnight)).toBe(true)
    expect(isWithinQuietHours(new Date('2026-01-15T12:00:00Z'), overnight)).toBe(false)
    expect(isWithinQuietHours(new Date('2026-01-15T08:00:00Z'), overnight)).toBe(false)
  })

  it('handles same-day windows', () => {
    const day = { ...overnight, quietHoursStart: '09:00', quietHoursEnd: '17:00' }
    expect(isWithinQuietHours(new Date('2026-01-15T12:00:00Z'), day)).toBe(true)
    expect(isWithinQuietHours(new Date('2026-01-15T18:00:00Z'), day)).toBe(false)
  })

  it('treats a zero-length window as no window', () => {
    expect(
      isWithinQuietHours(new Date('2026-01-15T12:00:00Z'), {
        ...overnight,
        quietHoursEnd: '22:00',
      }),
    ).toBe(false)
  })

  it('uses the DEFAULT window when no explicit times are stored', () => {
    expect(DEFAULT_QUIET_HOURS_START).toBe('22:00')
    expect(DEFAULT_QUIET_HOURS_END).toBe('08:00')
    expect(
      isWithinQuietHours(new Date('2026-01-15T23:00:00Z'), {
        quietHoursEnabled: true,
        timezone: 'UTC',
      }),
    ).toBe(true)
  })

  /**
   * الاختبار الحاسم: نفس اللحظة، نافذتان مختلفتان حسب المنطقة الزمنية.
   * UTC 15:00 ⇒ دبي 19:00 (خارج 22-08) لكن كيريباتي 05:00 التالي (داخلها).
   */
  it('evaluates the window in the recipient timezone, not the server one', () => {
    const instant = new Date('2026-01-15T15:00:00Z')
    expect(isWithinQuietHours(instant, { ...overnight, timezone: 'Asia/Dubai' })).toBe(false)
    expect(isWithinQuietHours(instant, { ...overnight, timezone: 'Pacific/Kiritimati' })).toBe(true)
  })

  it('treats a missing timezone as UTC (pre-P2 server behaviour)', () => {
    const instant = new Date('2026-01-15T23:00:00Z')
    expect(isWithinQuietHours(instant, { ...overnight, timezone: null })).toBe(true)
    expect(isWithinQuietHours(instant, { ...overnight, timezone: undefined })).toBe(true)
  })
})

describe('nextQuietHoursEnd', () => {
  const overnight = {
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: 'UTC',
  } as const

  it('returns tomorrow morning when the window crossed midnight', () => {
    const resume = nextQuietHoursEnd(new Date('2026-01-15T23:30:00Z'), overnight)
    expect(resume.toISOString()).toBe('2026-01-16T08:00:00.000Z')
  })

  it('returns today when the end is still ahead', () => {
    const day = { ...overnight, quietHoursStart: '09:00', quietHoursEnd: '17:00' }
    const resume = nextQuietHoursEnd(new Date('2026-01-15T12:00:00Z'), day)
    expect(resume.toISOString()).toBe('2026-01-15T17:00:00.000Z')
  })

  it('respects the recipient timezone when computing the resume point', () => {
    // 15:00Z = 21:00 في دبي (خارج الهدوء) لكن ينتهي الهدوء 08:00 بتوقيتها
    const resume = nextQuietHoursEnd(new Date('2026-01-15T15:00:00Z'), {
      ...overnight,
      timezone: 'Asia/Dubai',
    })
    // دبي (UTC+4): 15:00Z = 19:00 ⇒ خارج الهدوء، والطلب هنا يعطي نهاية
    // النافذة القادمة (08:00 بتوقيت دبي = 04:00Z التالي) لأن 08:00 اليوم
    // (04:00Z) مضى بالفعل.
    expect(resume.toISOString()).toBe('2026-01-16T04:00:00.000Z')
  })
})
