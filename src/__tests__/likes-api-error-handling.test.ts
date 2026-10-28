/**
 * Error-handling contract tests for src/app/api/creator/likes/route.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
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
const req = (url: string) => ({ url }) as any

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

describe('likes api error handling', () => {
  it('wraps the GET handler in try/catch', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/creator/likes/route.ts'),
      'utf8',
    )
    expect(content).toMatch(/export async function GET/)
    expect(content).toMatch(/try \{/)
    expect(content).toMatch(/catch \(err\)/)
    expect(content).toMatch(/internalError/)
  })

  it('logs failures with console.error including context', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(db.endorsement.count as jest.Mock).mockRejectedValue(new Error('boom'))
    await likesGET(req('http://x/api/creator/likes'))
    expect(spy).toHaveBeenCalled()
    const logged = JSON.stringify(spy.mock.calls)
    expect(logged).toMatch(/context|creator\/likes/i)
    spy.mockRestore()
  })

  it('returns 401 when unauthenticated', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: null, error: null })
    const res = await likesGET(req('http://x/api/creator/likes'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when forbidden', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: null,
      error: { status: 403, json: async () => ({ error: { code: 'FORBIDDEN' } }) },
    })
    const res = await likesGET(req('http://x/api/creator/likes'))
    expect(res.status).toBe(403)
  })

  it('returns 400 for an invalid range', async () => {
    const res = await likesGET(req('http://x/api/creator/likes?range=5'))
    expect(res.status).toBe(400)
  })

  it('returns 500 on unexpected error without leaking stack traces', async () => {
    ;(db.endorsement.count as jest.Mock).mockRejectedValue(new Error('secret stack trace'))
    const res = await likesGET(req('http://x/api/creator/likes'))
    expect(res.status).toBe(500)
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toMatch(/stack|secret stack trace/i)
  })
})
