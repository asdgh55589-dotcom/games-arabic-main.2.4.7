/**
 * @jest-environment node
 */
import { GET as likesGET } from '@/app/api/creator/likes/route'

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findMany: jest.fn() },
    endorsement: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    commentLike: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    modRating: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
    modComment: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const CREATOR = { id: 'u1', username: 'c1', email: 'c@x', role: 'creator', avatarUrl: null }
const req = (url: string) => ({ url, headers: new Headers() }) as any

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  ;(db.mod.findMany as jest.Mock).mockResolvedValue([{ id: 'm1', name: 'Mod One', slug: 'mod-one' }])
  ;(db.endorsement.count as jest.Mock).mockResolvedValue(0)
  ;(db.commentLike.count as jest.Mock).mockResolvedValue(0)
  ;(db.modRating.count as jest.Mock).mockResolvedValue(0)
  ;(db.modRating.aggregate as jest.Mock).mockResolvedValue({ _avg: { rating: null } })
  ;(db.endorsement.groupBy as jest.Mock).mockResolvedValue([])
  ;(db.commentLike.groupBy as jest.Mock).mockResolvedValue([])
  ;(db.modRating.groupBy as jest.Mock).mockResolvedValue([])
  ;(db.endorsement.findMany as jest.Mock).mockResolvedValue([])
  ;(db.commentLike.findMany as jest.Mock).mockResolvedValue([])
  ;(db.modRating.findMany as jest.Mock).mockResolvedValue([])
  ;(db.modComment.findMany as jest.Mock).mockResolvedValue([])
})

describe('likes semantics', () => {
  it('recent reactions query excludes thumbsdown (positives only)', async () => {
    await likesGET(req('http://x/api/creator/likes?range=7'))
    const calls = (db.endorsement.findMany as jest.Mock).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    expect(JSON.stringify(calls[0][0].where)).toContain('not')
  })

  it('negative reactions returned separately', async () => {
    ;(db.endorsement.count as jest.Mock)
      .mockResolvedValueOnce(1) // endoCur positive
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3) // negCur
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
    const res = await likesGET(req('http://x/api/creator/likes?range=7'))
    const body = await res.json()
    expect(body.data.summary.negativeReactions).toBe(3)
    expect(body.data.summary.endorsements).toBe(1)
  })

  it('per-mod breakdown shows both positive and negative counts', async () => {
    ;(db.endorsement.groupBy as jest.Mock).mockResolvedValue([
      { modId: 'm1', value: 'fire', _count: { _all: 4 } },
      { modId: 'm1', value: 'thumbsdown', _count: { _all: 2 } },
    ])
    const res = await likesGET(req('http://x/api/creator/likes?range=7'))
    const body = await res.json()
    expect(body.data.mods[0]).toMatchObject({ modId: 'm1', endorsements: 4, negativeReactions: 2 })
  })

  it('total likes count does not include comment dislikes', async () => {
    ;(db.commentLike.count as jest.Mock).mockResolvedValue(5)
    const res = await likesGET(req('http://x/api/creator/likes?range=7'))
    const body = await res.json()
    expect(body.data.summary.commentLikesTotal).toBe(5)
    const calls = (db.commentLike.count as jest.Mock).mock.calls
    expect(JSON.stringify(calls)).toContain('"value":"like"')
  })

  it('recent comment likes filter positives only', async () => {
    await likesGET(req('http://x/api/creator/likes?range=7'))
    const calls = (db.commentLike.findMany as jest.Mock).mock.calls
    if (calls.length > 0) {
      expect(JSON.stringify(calls[0][0].where)).toContain('"value":"like"')
    }
  })
})
