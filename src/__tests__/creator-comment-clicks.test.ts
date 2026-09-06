/**
 * WAVE B Task 5 — comment-section-click tracking: counter dedup/bot/privacy,
 * beacon route guards, analytics + history feed the funnel. UI wiring static.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

process.env.UPSTASH_REDIS_REST_URL = ''
process.env.UPSTASH_REDIS_REST_TOKEN = ''

jest.mock('@/lib/auth', () => ({
  getUserIdFromRequestCookies: jest.fn().mockResolvedValue(null),
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true, remaining: 4, resetAt: 0, limit: 5 })),
  rateLimitMiddleware: jest.fn(async () => null),
}))

import { getUserIdFromRequestCookies, requireCreatorStudio } from '@/lib/auth'
import { hashIdentity, isBot, recordCommentSectionClick } from '@/lib/counters'

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
  return { commentSectionClick: { create: jest.fn().mockResolvedValue({}) } }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUserId.mockReset()
  mockGetUserId.mockResolvedValue(null)
})

describe('recordCommentSectionClick', () => {
  it('bots never counted', async () => {
    const db = makeDb()
    const r = await recordCommentSectionClick('m1', makeReq('1.1.1.1', 'Googlebot/2.1'), db as any)
    expect(r.counted).toBe(false)
    expect(db.commentSectionClick.create).not.toHaveBeenCalled()
  })

  it('guest row stores ipHash (never raw IP) + null userId', async () => {
    const db = makeDb()
    const r = await recordCommentSectionClick('m1', makeReq('9.9.9.9'), db as any)
    expect(r.counted).toBe(true)
    const data = (db.commentSectionClick.create as jest.Mock).mock.calls[0][0].data
    expect(data.modId).toBe('m1')
    expect(data.userId).toBeNull()
    expect(data.ipHash).toBeTruthy()
    expect(JSON.stringify(data)).not.toContain('9.9.9.9')
  })

  it('authed row stores userId + null ipHash', async () => {
    mockGetUserId.mockResolvedValue('u7')
    const db = makeDb()
    const r = await recordCommentSectionClick('m1', makeReq('9.9.9.9'), db as any)
    expect(r.counted).toBe(true)
    const data = (db.commentSectionClick.create as jest.Mock).mock.calls[0][0].data
    expect(data.userId).toBe('u7')
    expect(data.ipHash).toBeNull()
  })

  it('dedups repeat opens (same identity), counts new identity', async () => {
    const db = makeDb()
    expect((await recordCommentSectionClick('m1', makeReq('3.3.3.3'), db as any)).counted).toBe(true)
    expect((await recordCommentSectionClick('m1', makeReq('3.3.3.3'), db as any)).counted).toBe(false)
    expect((await recordCommentSectionClick('m1', makeReq('4.4.4.4'), db as any)).counted).toBe(true)
    expect(db.commentSectionClick.create).toHaveBeenCalledTimes(2)
  })

  it('hashIdentity is deterministic', () => {
    expect(hashIdentity('a')).toBe(hashIdentity('a'))
    expect(hashIdentity('a')).not.toBe(hashIdentity('b'))
  })
})

describe('POST /api/mods/[slug]/comment-click', () => {
  it('beacon plumbing is wired (static): rate-limit + bot + mod lookup + record', () => {
    const root = process.cwd()
    const src = fs.readFileSync(
      path.join(root, 'src/app/api/mods/[slug]/comment-click/route.ts'),
      'utf8',
    )
    expect(src).toMatch(/rateLimit\(req, \{ limit: 30/)
    expect(src).toMatch(/isBot\(userAgent\)/)
    expect(src).toMatch(/recordCommentSectionClick\(mod\.id, req, db\)/)
    expect(isBot('curl/8.0')).toBe(true)
  })
})

describe('analytics feed (static: funnel fields present)', () => {
  const root = process.cwd()
  const analytics = fs.readFileSync(
    path.join(root, 'src/app/api/creator/analytics/route.ts'),
    'utf8',
  )
  const history = fs.readFileSync(
    path.join(root, 'src/app/api/creator/analytics/history/route.ts'),
    'utf8',
  )

  it('summary exposes comment-clicks + funnel conversion rates', () => {
    expect(analytics).toMatch(/totalCommentClicks/)
    expect(analytics).toMatch(/commentClicksChange/)
    expect(analytics).toMatch(/viewToDownloadPct/)
    expect(analytics).toMatch(/downloadToClickPct/)
    expect(analytics).toMatch(/commentSectionClick\.count/)
  })

  it('history exposes per-day comment-click buckets + totals', () => {
    expect(history).toMatch(/commentClicksBuckets/)
    expect(history).toMatch(/commentSectionClick\.findMany/)
    expect(history).toMatch(/totalCommentClicks/)
  })
})

describe('beacon component wiring (static)', () => {
  const root = process.cwd()
  const beacon = fs.readFileSync(
    path.join(root, 'src/components/comment-section-beacon.tsx'),
    'utf8',
  )
  const desktop = fs.readFileSync(path.join(root, 'src/views/mod-detail.tsx'), 'utf8')
  const mobile = fs.readFileSync(path.join(root, 'src/views/mod-detail-mobile.tsx'), 'utf8')

  it('fires once per session per mod, mounted beside (not inside) ModComments', () => {
    expect(beacon).toMatch(/sessionStorage/)
    expect(beacon).toMatch(/\/api\/mods\/.*\/comment-click/)
    expect(beacon).toMatch(/keepalive/)
    expect(beacon).not.toMatch(/<ModComments|mod-comments' \}/)
    expect(desktop).toMatch(/<CommentSectionBeacon slug=\{mod\.slug\} \/>/)
    expect(mobile).toMatch(/<CommentSectionBeacon slug=\{mod\.slug\} \/>/)
  })
})
