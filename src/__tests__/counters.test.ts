process.env.UPSTASH_REDIS_REST_URL = ''
process.env.UPSTASH_REDIS_REST_TOKEN = ''

jest.mock('@/lib/auth', () => ({
  getUserIdFromRequestCookies: jest.fn().mockResolvedValue(null),
}))

import { isBot, recordModView, recordTeamView, recordDownload } from '@/lib/counters'
import { getUserIdFromRequestCookies } from '@/lib/auth'

const mockGetUserId = getUserIdFromRequestCookies as jest.MockedFunction<
  typeof getUserIdFromRequestCookies
>

function makeReq(ip: string, ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0'): Request {
  return new Request('http://localhost/api/test', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip, 'user-agent': ua },
  })
}

function makeDb() {
  return {
    mod: { update: jest.fn().mockResolvedValue({}) },
    team: { update: jest.fn().mockResolvedValue({}) },
    modView: { create: jest.fn().mockResolvedValue({}) },
    downloadClick: { create: jest.fn().mockResolvedValue({}) },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUserId.mockReset()
  mockGetUserId.mockResolvedValue(null)
})

describe('isBot', () => {
  it('يقبل User-Agent فارغ (privacy browsers) — لا يُعتبر bot', () => {
    expect(isBot(null)).toBe(false)
    expect(isBot('')).toBe(false)
  })

  it('يرفض bots الواضحة', () => {
    expect(isBot('Googlebot/2.1')).toBe(true)
    expect(isBot('curl/8.0')).toBe(true)
    expect(isBot('HeadlessChrome/120')).toBe(true)
    expect(isBot('python-requests/2.31')).toBe(true)
  })

  it('يقبل متصفح بشري', () => {
    expect(isBot('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120.0 Safari/537')).toBe(false)
  })
})

describe('recordModView — dedup', () => {
  it('أول مشاهدة تُحتسب وترفع العداد وتكتب ModView', async () => {
    const db = makeDb()
    const r1 = await recordModView('mod-aaa', makeReq('1.1.1.1'), db)
    expect(r1.counted).toBe(true)
    expect(db.mod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mod-aaa' },
        data: { views: { increment: 1 } },
      }),
    )
    expect(db.modView.create).toHaveBeenCalledTimes(1)
  })

  it('نفس الزائر خلال الساعة لا يُحتسب مرة ثانية (refresh)', async () => {
    const db = makeDb()
    await recordModView('mod-bbb', makeReq('2.2.2.2'), db)
    const r2 = await recordModView('mod-bbb', makeReq('2.2.2.2'), db)
    const r3 = await recordModView('mod-bbb', makeReq('2.2.2.2'), db)
    expect(r2.counted).toBe(false)
    expect(r3.counted).toBe(false)
    expect(db.mod.update).toHaveBeenCalledTimes(1)
    expect(db.modView.create).toHaveBeenCalledTimes(1)
  })

  it('زائر مختلف IP يُحتسب', async () => {
    await recordModView('mod-ccc', makeReq('3.3.3.3'), makeDb())
    const db = makeDb()
    const r = await recordModView('mod-ccc', makeReq('4.4.4.4'), db)
    expect(r.counted).toBe(true)
  })

  it('bots لا تُحتسب إطلاقاً', async () => {
    const db = makeDb()
    const r = await recordModView('mod-bot', makeReq('5.5.5.5', 'Googlebot/2.1'), db)
    expect(r.counted).toBe(false)
    expect(db.mod.update).not.toHaveBeenCalled()
  })

  it('المستخدم المسجل: userId في الصف وIP صفر، ومفتاح dedup مستقل عن الـ IP', async () => {
    mockGetUserId.mockResolvedValue('user-x')
    const db = makeDb()
    const r = await recordModView('mod-ddd', makeReq('9.9.9.9'), db)
    expect(r.counted).toBe(true)
    const arg = db.modView.create.mock.calls[0][0].data
    expect(arg.userId).toBe('user-x')
    expect(arg.ipAddress).toBeNull()

    // نفس المستخدم من IP آخر — ما زال مكرراً (24h)
    const db2 = makeDb()
    const r2 = await recordModView('mod-ddd', makeReq('8.8.8.8'), db2)
    expect(r2.counted).toBe(false)
  })
})

describe('recordTeamView — dedup', () => {
  it('زيارة فريدة ترفع Team.views والمكرر لا', async () => {
    const db = makeDb()
    expect((await recordTeamView('team-1', makeReq('6.6.6.6'), db)).counted).toBe(true)
    expect(db.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { views: { increment: 1 } },
    })
    const r2 = await recordTeamView('team-1', makeReq('6.6.6.6'), db)
    expect(r2.counted).toBe(false)
    // فريق مختلف يُحتسب بشكل مستقل
    const r3 = await recordTeamView('team-2', makeReq('6.6.6.6'), db)
    expect(r3.counted).toBe(true)
  })
})

describe('recordDownload — dedup لكل رابط', () => {
  it('نفس الرابط مرتين = تحميل واحد، روابط مختلفة = اثنان', async () => {
    const base = { modId: 'mod-dl', userId: null }
    const db = makeDb()
    await recordDownload(
      { ...base, linkId: 'link-a', fileId: 'f1', linkUrl: 'http://x/a' },
      makeReq('7.7.7.7'),
      db,
    )
    const r2 = await recordDownload(
      { ...base, linkId: 'link-a', fileId: 'f1', linkUrl: 'http://x/a' },
      makeReq('7.7.7.7'),
      db,
    )
    expect(r2.counted).toBe(false)

    const r3 = await recordDownload(
      { ...base, linkId: 'link-b', fileId: 'f2', linkUrl: 'http://x/b' },
      makeReq('7.7.7.7'),
      db,
    )
    expect(r3.counted).toBe(true)

    // العداد زُيد مرتين فقط، وسجلا نقرات بـ fileId صحيح
    expect(db.mod.update).toHaveBeenCalledTimes(2)
    const clicks = db.downloadClick.create.mock.calls.map((c) => c[0].data)
    expect(clicks[0].fileId).toBe('f1')
    expect(clicks[0].userId).toBeNull()
    expect(clicks[0].ipAddress).toBe('7.7.7.7')
  })

  it('المستخدم المسجل يظهر في سجل النقرات', async () => {
    mockGetUserId.mockResolvedValue('user-y')
    const db = makeDb()
    await recordDownload(
      { modId: 'mod-dl2', userId: 'user-y', linkId: 'link-c', fileId: 'f3', linkUrl: 'u' },
      makeReq('7.7.7.9'),
      db,
    )
    const data = db.downloadClick.create.mock.calls[0][0].data
    expect(data.userId).toBe('user-y')
    expect(data.linkId).toBe('link-c')
  })
})
