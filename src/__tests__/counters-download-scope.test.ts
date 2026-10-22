/**
 * R24 — نطاق الـ dedup لالتحميلات = لكل FILE وليس لكل رابط (mirror).
 *
 * السبب: مود واحد قد يكون له عدة روابط مرايا (mirrors) لنفس الملف.
 * بالنطاق القديم (لكل رابط) كان مستخدم واحد يولّد عدة تحميلات محسوبة في
 * اليوم نفسه عبر روابط المرايا — تضخّم لعداد Mod.downloads.
 */
jest.mock('@/lib/auth', () => ({
  getUserIdFromRequestCookies: jest.fn().mockResolvedValue(null),
}))

// R23 — إعادة الفهرسة في Meilisearch: best-effort، لا نريدها في الاختبار.
jest.mock('@/lib/meilisearch/indexer', () => ({
  reindexModById: jest.fn().mockResolvedValue(undefined),
}))

import { getUserIdFromRequestCookies } from '@/lib/auth'
import { recordDownload } from '@/lib/counters'

const mockGetUserId = getUserIdFromRequestCookies as jest.MockedFunction<
  typeof getUserIdFromRequestCookies
>

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function makeReq(ip: string): Request {
  return new Request('http://localhost/api/mods/x/download/link', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip, 'user-agent': BROWSER_UA },
  })
}

function makeDb() {
  return {
    mod: { update: jest.fn().mockResolvedValue({}) },
    downloadClick: { create: jest.fn().mockResolvedValue({}) },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUserId.mockReset()
  mockGetUserId.mockResolvedValue(null)
})

describe('recordDownload — نطاق الـ dedup لكل ملف (R24)', () => {
  it('رابطان مختلفان لنفس الملف = تحميل واحد محسوب', async () => {
    const db = makeDb()
    const first = await recordDownload(
      { modId: 'mod-1', linkId: 'link-a', fileId: 'file-1', linkUrl: 'http://x/a' },
      makeReq('20.0.0.1'),
      db,
    )
    const second = await recordDownload(
      { modId: 'mod-1', linkId: 'link-b', fileId: 'file-1', linkUrl: 'http://x/b' },
      makeReq('20.0.0.1'),
      db,
    )

    expect(first.counted).toBe(true)
    expect(second.counted).toBe(false)

    expect(db.downloadClick.create).toHaveBeenCalledTimes(1)
    expect(db.mod.update).toHaveBeenCalledTimes(1)

    const row = db.downloadClick.create.mock.calls[0][0].data
    expect(row.fileId).toBe('file-1')
    expect(row.linkId).toBe('link-a')
  })

  it('ملفان مختلفان لنفس المود = تحميلان محسوبان', async () => {
    const db = makeDb()
    const first = await recordDownload(
      { modId: 'mod-2', linkId: 'link-a', fileId: 'file-x', linkUrl: 'http://x/a' },
      makeReq('20.0.0.2'),
      db,
    )
    const second = await recordDownload(
      { modId: 'mod-2', linkId: 'link-b', fileId: 'file-y', linkUrl: 'http://x/b' },
      makeReq('20.0.0.2'),
      db,
    )

    expect(first.counted).toBe(true)
    expect(second.counted).toBe(true)

    expect(db.downloadClick.create).toHaveBeenCalledTimes(2)
    expect(db.mod.update).toHaveBeenCalledTimes(2)

    const rows = db.downloadClick.create.mock.calls.map((c) => c[0].data)
    expect(rows.map((r) => r.fileId)).toEqual(['file-x', 'file-y'])
  })

  it('نفس الملف من زائر مختلف = تحميل محسوب (النطاق على الهوية + الملف)', async () => {
    const db = makeDb()
    const first = await recordDownload(
      { modId: 'mod-3', linkId: 'link-a', fileId: 'file-z', linkUrl: 'http://x/a' },
      makeReq('20.0.0.3'),
      db,
    )
    const second = await recordDownload(
      { modId: 'mod-3', linkId: 'link-a', fileId: 'file-z', linkUrl: 'http://x/a' },
      makeReq('20.0.0.4'),
      db,
    )

    expect(first.counted).toBe(true)
    expect(second.counted).toBe(true)
    expect(db.mod.update).toHaveBeenCalledTimes(2)
  })

  it('بدون fileId يقع النطاق على المود (سلوك احتياطي)', async () => {
    const db = makeDb()
    const first = await recordDownload(
      { modId: 'mod-4', linkId: 'link-a', fileId: null, linkUrl: 'http://x/a' },
      makeReq('20.0.0.5'),
      db,
    )
    const second = await recordDownload(
      { modId: 'mod-4', linkId: 'link-b', fileId: null, linkUrl: 'http://x/b' },
      makeReq('20.0.0.5'),
      db,
    )

    expect(first.counted).toBe(true)
    expect(second.counted).toBe(false)
    expect(db.downloadClick.create).toHaveBeenCalledTimes(1)
  })
})
