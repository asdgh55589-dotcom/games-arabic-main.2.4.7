import { listVisibleComments } from '@/lib/comments/repository'

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  },
}))

import { db } from '@/lib/db'

function mockFindMany(rows: any[]) {
  ;(db.modComment.findMany as jest.Mock).mockImplementation(async (args: any) => {
    const w = args?.where ?? {}
    if (w.id?.in) return rows.filter((c) => w.id.in.includes(c.id))
    if (w.parentId && typeof w.parentId === 'object' && 'in' in w.parentId)
      return rows.filter((c) => c.parentId && w.parentId.in.includes(c.parentId))
    if (w.parentId === null) return rows.filter((c) => c.parentId == null)
    return rows
  })
}

describe('comments threading refactor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(db.modComment.count as jest.Mock).mockResolvedValue(3)
  })

  it('returns comments without replies field', async () => {
    const rows = [
      { id: 'r1', parentId: null, likes: 1, isPinned: false, createdAt: new Date(), depth: 0, user: null, modId: 'm', isHidden: false },
    ]
    mockFindMany(rows)
    const res = await listVisibleComments('m', { sort: 'newest', limit: 20, cursor: null })
    for (const c of res.comments) {
      expect(c).not.toHaveProperty('replies')
    }
  })

  it('adds replyCount to each comment', async () => {
    const rows = [
      { id: 'r1', parentId: null, likes: 1, isPinned: false, createdAt: new Date(), depth: 0, user: null, modId: 'm', isHidden: false },
      { id: 'c2', parentId: 'r1', likes: 0, isPinned: false, createdAt: new Date(), depth: 1, user: null, modId: 'm', isHidden: false },
      { id: 'c3', parentId: 'r1', likes: 0, isPinned: false, createdAt: new Date(), depth: 1, user: null, modId: 'm', isHidden: false },
    ]
    mockFindMany(rows)
    const res = await listVisibleComments('m', { sort: 'newest', limit: 20, cursor: null })
    expect(res.comments[0]).toHaveProperty('replyCount')
    expect(res.comments[0].replyCount).toBe(2)
  })

  it('replyCount is 0 when no direct replies', async () => {
    const rows = [
      { id: 'r1', parentId: null, likes: 1, isPinned: false, createdAt: new Date(), depth: 0, user: null, modId: 'm', isHidden: false },
    ]
    mockFindMany(rows)
    const res = await listVisibleComments('m', { sort: 'newest', limit: 20, cursor: null })
    expect(res.comments[0].replyCount).toBe(0)
  })

  it('preserves total and totalRoots', async () => {
    const rows = [
      { id: 'r1', parentId: null, likes: 1, isPinned: false, createdAt: new Date(), depth: 0, user: null, modId: 'm', isHidden: false },
    ]
    mockFindMany(rows)
    ;(db.modComment.count as jest.Mock).mockResolvedValue(5)
    const res = await listVisibleComments('m', { sort: 'newest', limit: 20, cursor: null })
    expect(res.total).toBe(5)
    expect(res.totalRoots).toBe(1)
  })

  it('does not include replies property in type usage', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const types = fs.readFileSync(path.join(process.cwd(), 'src/lib/types.ts'), 'utf8')
    expect(types).not.toMatch(/replies\?: ModCommentType\[\]/)
    expect(types).toMatch(/replyCount\?: number/)
  })

  it('clients do not reference .replies', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    for (const f of ['src/components/comments/comment-card.tsx', 'src/components/creator/comments-manager.tsx', 'src/components/comments/use-comments.ts']) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
      expect(src).not.toMatch(/\.replies/)
    }
  })
})