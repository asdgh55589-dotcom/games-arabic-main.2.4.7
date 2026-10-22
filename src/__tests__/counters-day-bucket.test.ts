/**
 * C3 — `dayBucket`: بداية اليوم بتوقيت UTC.
 *
 * يُكتب في ModView و DownloadClick ليُبنى الـ dedup الدائم (unique index)
 * على (اليوم + الهوية) — بدلاً من dedup داخل الذاكرة فقط.
 */
jest.mock('@/lib/auth', () => ({
  getUserIdFromRequestCookies: jest.fn().mockResolvedValue(null),
}))

// R23 — best-effort، لا نريد استدعاء Meilisearch في الاختبار.
jest.mock('@/lib/meilisearch/indexer', () => ({
  reindexModById: jest.fn().mockResolvedValue(undefined),
}))

import { getUserIdFromRequestCookies } from '@/lib/auth'
import { recordDownload, recordModView, startOfUtcDay } from '@/lib/counters'

const mockGetUserId = getUserIdFromRequestCookies as jest.MockedFunction<
  typeof getUserIdFromRequestCookies
>

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function makeReq(ip: string): Request {
  return new Request('http://localhost/api/mods/x', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip, 'user-agent': BROWSER_UA },
  })
}

function makeDb() {
  return {
    mod: { update: jest.fn().mockResolvedValue({}) },
    modView: { create: jest.fn().mockResolvedValue({}) },
    downloadClick: { create: jest.fn().mockResolvedValue({}) },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUserId.mockReset()
  mockGetUserId.mockResolvedValue(null)
})

describe('startOfUtcDay — منتصف ليل UTC', () => {
  it('يحوّل لحظة في اليوم إلى 00:00:00.000 UTC من نفس اليوم', () => {
    expect(startOfUtcDay(new Date('2026-10-21T13:45:12.345Z')).toISOString()).toBe(
      '2026-10-21T00:00:00.000Z',
    )
  })

  it('لحظة قبل منتصف الليل بالضبط تبقى في نفس اليوم', () => {
    expect(startOfUtcDay(new Date('2026-10-21T00:00:00.000Z')).toISOString()).toBe(
      '2026-10-21T00:00:00.000Z',
    )
  })

  it('آخر لحظة في اليوم قبل الانتقال', () => {
    expect(startOfUtcDay(new Date('2026-10-21T23:59:59.999Z')).toISOString()).toBe(
      '2026-10-21T00:00:00.000Z',
    )
  })

  it('حدود الشهر', () => {
    expect(startOfUtcDay(new Date('2026-11-01T00:30:00.000Z')).toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    )
    expect(startOfUtcDay(new Date('2026-10-31T23:00:00.000Z')).toISOString()).toBe(
      '2026-10-31T00:00:00.000Z',
    )
  })

  it('حدود السنة', () => {
    expect(startOfUtcDay(new Date('2026-01-01T05:00:00.000Z')).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    )
    expect(startOfUtcDay(new Date('2026-12-31T23:00:00.000Z')).toISOString()).toBe(
      '2026-12-31T00:00:00.000Z',
    )
  })

  it('يُرجع Date (وليس نصاً)', () => {
    expect(startOfUtcDay(new Date('2026-10-21T13:45:12.345Z'))).toBeInstanceOf(Date)
  })
})

describe('dayBucket في الصفوف المكتوبة', () => {
  // نثبّت "الآن" على لحظة ثابتة mid-day (الساعة 13:45 UTC) — اليوم ليس منتصف ليل.
  const NOW = new Date('2026-10-21T13:45:12.345Z')
  const EXPECTED = new Date('2026-10-21T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'performance',
        'hrtime',
      ],
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('modView.create يستقبل dayBucket = منتصف ليل UTC', async () => {
    const db = makeDb()
    const result = await recordModView('mod-day', makeReq('30.0.0.1'), db)

    expect(result.counted).toBe(true)
    const data = db.modView.create.mock.calls[0][0].data
    expect(data.dayBucket).toBeInstanceOf(Date)
    expect((data.dayBucket as Date).toISOString()).toBe(EXPECTED.toISOString())
  })

  it('downloadClick.create يستقبل dayBucket = منتصف ليل UTC', async () => {
    const db = makeDb()
    const result = await recordDownload(
      { modId: 'mod-day-dl', linkId: 'l1', fileId: 'f1', linkUrl: 'http://x/a' },
      makeReq('30.0.0.2'),
      db,
    )

    expect(result.counted).toBe(true)
    const data = db.downloadClick.create.mock.calls[0][0].data
    expect(data.dayBucket).toBeInstanceOf(Date)
    expect((data.dayBucket as Date).toISOString()).toBe(EXPECTED.toISOString())
  })

  it('dayBucket يقع ضمن نفس اليوم UTC', async () => {
    const db = makeDb()
    await recordModView('mod-day-2', makeReq('30.0.0.3'), db)
    const data = db.modView.create.mock.calls[0][0].data
    const bucket = data.dayBucket as Date
    expect(bucket.getTime()).toBeLessThanOrEqual(NOW.getTime())
    expect(NOW.getTime() - bucket.getTime()).toBeLessThan(24 * 60 * 60 * 1000)
    expect(bucket.getUTCHours()).toBe(0)
    expect(bucket.getUTCMinutes()).toBe(0)
    expect(bucket.getUTCSeconds()).toBe(0)
    expect(bucket.getUTCMilliseconds()).toBe(0)
  })
})
