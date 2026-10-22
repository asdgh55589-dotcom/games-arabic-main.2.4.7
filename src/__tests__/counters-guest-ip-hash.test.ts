/**
 * R30 — الخصوصية: ModView.ipAddress / DownloadClick.ipAddress تخزّن معرّفاً
 * مُجزّأً (hashIdentity) لا عنوان IP خاماً (GDPR).
 *
 * المستخدم المسجَّل يُعرَّف بـ userId فقط → ipAddress = null.
 */
jest.mock('@/lib/auth', () => ({
  getUserIdFromRequestCookies: jest.fn().mockResolvedValue(null),
}))

// R23 — best-effort، لا نريد استدعاء Meilisearch في الاختبار.
jest.mock('@/lib/meilisearch/indexer', () => ({
  reindexModById: jest.fn().mockResolvedValue(undefined),
}))

import { getUserIdFromRequestCookies } from '@/lib/auth'
import { hashIdentity, recordDownload, recordModView } from '@/lib/counters'

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

describe('R30 — ModView.ipAddress مُجزّأ للزائر', () => {
  it('الزائر: يُخزَّن hash وليس الـ IP الخام', async () => {
    const rawIp = '203.0.113.45'
    const db = makeDb()
    const result = await recordModView('mod-guest', makeReq(rawIp), db)

    expect(result.counted).toBe(true)
    const data = db.modView.create.mock.calls[0][0].data
    expect(data.ipAddress).not.toBe(rawIp)
    expect(data.ipAddress).toBe(hashIdentity(rawIp))
    expect(typeof data.ipAddress).toBe('string')
    // الهاش قصير ولا يحتوي على الـ IP
    expect(String(data.ipAddress)).not.toContain(rawIp)
  })

  it('المستخدم المسجَّل: ipAddress = null و userId مضبوط', async () => {
    mockGetUserId.mockResolvedValue('user-42')
    const db = makeDb()
    const result = await recordModView('mod-auth', makeReq('203.0.113.46'), db)

    expect(result.counted).toBe(true)
    const data = db.modView.create.mock.calls[0][0].data
    expect(data.ipAddress).toBeNull()
    expect(data.userId).toBe('user-42')
  })
})

describe('R30 — DownloadClick.ipAddress مُجزّأ', () => {
  it('الزائر: يُخزَّن hash وليس الـ IP الخام', async () => {
    const rawIp = '198.51.100.7'
    const db = makeDb()
    const result = await recordDownload(
      { modId: 'mod-dl-guest', linkId: 'l1', fileId: 'f1', linkUrl: 'http://x/a' },
      makeReq(rawIp),
      db,
    )

    expect(result.counted).toBe(true)
    const data = db.downloadClick.create.mock.calls[0][0].data
    expect(data.ipAddress).not.toBe(rawIp)
    expect(data.ipAddress).toBe(hashIdentity(rawIp))
  })

  it('المستخدم المسجَّل: userId يبقى كما هو (لا يُمسح)', async () => {
    mockGetUserId.mockResolvedValue('user-77')
    const db = makeDb()
    await recordDownload(
      {
        modId: 'mod-dl-auth',
        linkId: 'l1',
        fileId: 'f1',
        linkUrl: 'http://x/a',
        userId: 'user-77',
      },
      makeReq('198.51.100.8'),
      db,
    )

    const data = db.downloadClick.create.mock.calls[0][0].data
    expect(data.userId).toBe('user-77')
    expect(data.ipAddress).toBe(hashIdentity('198.51.100.8'))
  })
})

describe('hashIdentity — خصائص الهاش', () => {
  it('نفس المدخل = نفس الهاش، ومدخل مختلف = هاش مختلف', () => {
    expect(hashIdentity('1.2.3.4')).toBe(hashIdentity('1.2.3.4'))
    expect(hashIdentity('1.2.3.4')).not.toBe(hashIdentity('1.2.3.5'))
  })

  it('الهاش لا يحتوي على الـ IP الخام', () => {
    expect(hashIdentity('192.0.2.10')).not.toContain('192.0.2.10')
  })
})
