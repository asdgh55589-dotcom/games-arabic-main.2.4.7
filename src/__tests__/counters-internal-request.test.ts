/**
 * C1/R1 — الطلب الداخلي من الخادم (ISR self-fetch) لا يُحتسب أبداً.
 *
 * الخادم (ISR) يستدعي /api/mods/[slug] من نفسه — بدون ترويسة `x-ga-internal: 1`
 * كان يُسجَّل كمشاهدة/تحميل حقيقية، فكانت أرقام الإحصاءات م inflation من ISR.
 */
jest.mock('@/lib/auth', () => ({
  getUserIdFromRequestCookies: jest.fn().mockResolvedValue(null),
}))

import { getUserIdFromRequestCookies } from '@/lib/auth'
import {
  INTERNAL_REQUEST_HEADER,
  isInternalRequest,
  recordDownload,
  recordModView,
} from '@/lib/counters'

const mockGetUserId = getUserIdFromRequestCookies as jest.MockedFunction<
  typeof getUserIdFromRequestCookies
>

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function makeReq(opts: { ip?: string; internal?: boolean; ua?: string } = {}): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': opts.ip ?? '10.0.0.1',
    'user-agent': opts.ua ?? BROWSER_UA,
  }
  if (opts.internal) headers[INTERNAL_REQUEST_HEADER] = '1'
  return new Request('http://localhost/api/mods/x', { method: 'GET', headers })
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

describe('isInternalRequest — الترويسة', () => {
  it('صحيح فقط عندما تكون القيمة حرفياً "1"', () => {
    const req = new Request('http://x/', { headers: { [INTERNAL_REQUEST_HEADER]: '1' } })
    expect(isInternalRequest(req)).toBe(true)
  })

  it('أي قيمة أخرى لا تُعتبر طلباً داخلياً', () => {
    for (const value of ['0', 'true', 'yes', '2', '11', '01', '']) {
      const req = new Request('http://x/', { headers: { [INTERNAL_REQUEST_HEADER]: value } })
      expect(isInternalRequest(req)).toBe(false)
    }
  })

  it('HTTP يtrimّ الفراغات حول قيمة الترويسة — " 1 " تُعامل كـ "1"', () => {
    // سلوك معياري لـ Headers: المسافات المحيطة تُزال قبل التخزين.
    const req = new Request('http://x/', { headers: { [INTERNAL_REQUEST_HEADER]: ' 1 ' } })
    expect(req.headers.get(INTERNAL_REQUEST_HEADER)).toBe('1')
    expect(isInternalRequest(req)).toBe(true)
  })

  it('غياب الترويسة = طلب خارجي', () => {
    const req = new Request('http://x/', { headers: {} })
    expect(isInternalRequest(req)).toBe(false)
  })
})

describe('recordModView — الطلب الداخلي لا يُحتسب', () => {
  it('counted=false ولا كتابة على DB إطلاقاً', async () => {
    const db = makeDb()
    const result = await recordModView('mod-internal', makeReq({ internal: true }), db)

    expect(result.counted).toBe(false)
    expect(db.modView.create).not.toHaveBeenCalled()
    expect(db.mod.update).not.toHaveBeenCalled()
  })

  it('الطلب الخارجي لنفس المود/ip يُحتسب (لإثبات أن الفارق هو الترويسة)', async () => {
    const db = makeDb()
    const result = await recordModView('mod-external', makeReq({ ip: '10.0.0.2' }), db)

    expect(result.counted).toBe(true)
    expect(db.modView.create).toHaveBeenCalledTimes(1)
    expect(db.mod.update).toHaveBeenCalledTimes(1)
  })
})

describe('recordDownload — الطلب الداخلي لا يُحتسب', () => {
  it('counted=false ولا كتابة على DB إطلاقاً', async () => {
    const db = makeDb()
    const result = await recordDownload(
      { modId: 'mod-internal-dl', linkId: 'l1', fileId: 'f1', linkUrl: 'http://x/a' },
      makeReq({ internal: true }),
      db,
    )

    expect(result.counted).toBe(false)
    expect(db.downloadClick.create).not.toHaveBeenCalled()
    expect(db.mod.update).not.toHaveBeenCalled()
  })

  it('الطلب الخارجي لنفس الملف/ip يُحتسب', async () => {
    const db = makeDb()
    const result = await recordDownload(
      { modId: 'mod-external-dl', linkId: 'l1', fileId: 'f1', linkUrl: 'http://x/a' },
      makeReq({ ip: '10.0.0.3' }),
      db,
    )

    expect(result.counted).toBe(true)
    expect(db.downloadClick.create).toHaveBeenCalledTimes(1)
  })
})
