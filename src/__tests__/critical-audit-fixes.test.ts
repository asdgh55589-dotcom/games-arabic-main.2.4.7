/**
 * CRITICAL audit fixes — leaderboard fan-out + authors bound verification.
 */
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))

const mockGroupBy = jest.fn()
const mockUserFindMany = jest.fn()
const mockAuthorFindFirst = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    mod: { groupBy: (...a: Array<never>) => mockGroupBy(...a) },
    user: {
      findMany: (...a: Array<never>) => mockUserFindMany(...a),
      findFirst: (...a: Array<never>) => mockAuthorFindFirst(...a),
    },
  },
}))

import { GET as leaderboardGET } from '@/app/api/leaderboard/creators/route'
import { GET as authorModsGET } from '@/app/api/authors/[username]/mods/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

beforeEach(() => jest.clearAllMocks())

describe('leaderboard: 2 queries, same contract', () => {
  it('aggregates once, fetches authors once, ranks tier-first and slices 10', async () => {
    mockGroupBy.mockResolvedValue([
      { authorId: 'u1', _count: { id: 3 }, _sum: { downloads: 900 } },
      { authorId: 'u2', _count: { id: 1 }, _sum: { downloads: 5000 } },
    ])
    mockUserFindMany.mockResolvedValue([
      { id: 'u1', username: 'a', tier: 5 },
      { id: 'u2', username: 'b', tier: 1 },
    ])
    const res = await leaderboardGET()
    expect(res.status).toBe(200)
    expect(mockGroupBy).toHaveBeenCalledTimes(1)
    expect(mockUserFindMany).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    // tier-first sort preserved (u1 tier 5 before u2 despite fewer downloads)
    expect(body.data[0].user.id).toBe('u1')
    expect(body.data[0].publishedCount).toBe(3)
    expect(body.data[0].totalDownloads).toBe(900)
  })

  it('filters out authors with zero published mods', async () => {
    mockGroupBy.mockResolvedValue([])
    mockUserFindMany.mockResolvedValue([])
    const body = await (await leaderboardGET()).json()
    expect(body.data).toEqual([])
  })
})

describe('authors nested mods bounded', () => {
  it('caps nested mods with take (no unbounded include)', async () => {
    mockAuthorFindFirst.mockResolvedValue({
      id: 'u1',
      username: 'a',
      mods: [{ id: 'm1' }],
    })
    const req = new NextRequest('http://x/api/authors/a/mods')
    const res = await authorModsGET(req, { params: Promise.resolve({ username: 'a' }) })
    expect(res.status).toBe(200)
    const take = mockAuthorFindFirst.mock.calls[0][0]?.select?.mods?.take
    expect(typeof take).toBe('number')
    expect(take).toBeLessThanOrEqual(50)
  })
})
