import * as fs from 'node:fs'
import * as path from 'node:path'

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : typeof ops === 'function' ? ops() : ops,
    ),
  },
}))
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
  getOptionalSession: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn(async () => null),
  rateLimit: jest.fn(async () => ({ success: true, remaining: 4, resetAt: 0, limit: 5 })),
}))
jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: () => ({
    sendCommentReply: { execute: jest.fn().mockResolvedValue(undefined) },
    sendTopLevelComment: { execute: jest.fn().mockResolvedValue(undefined) },
  }),
}))

import { requireCreatorStudio, getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET as creatorGET } from '@/app/api/creator/comments/route'
import { POST as modsPOST } from '@/app/api/mods/[slug]/comments/route'

const root = process.cwd()
const req = (url: string, body?: unknown) => ({ url, json: async () => body ?? {} }) as any

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: { id: 'u1', username: 'c', role: 'publisher' }, error: null })
  ;(getOptionalSession as jest.Mock).mockResolvedValue({ id: 'u1', username: 'u', role: 'member' })
  const rl = require('@/lib/rate-limit')
  ;(rl.rateLimit as jest.Mock).mockResolvedValue({ success: true })
  ;(rl.rateLimitMiddleware as jest.Mock).mockResolvedValue(null)
  ;(getOptionalSession as jest.Mock).mockResolvedValue({ id: 'u1', username: 'u', role: 'member' })
  ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', name: 'Mod', authorId: 'a1' })
  ;(db.mod.update as jest.Mock).mockResolvedValue({})
  ;(db.modComment.count as jest.Mock).mockResolvedValue(2)
  ;(db.modComment.findMany as jest.Mock).mockResolvedValue([
    { id: 'c1', text: 'hi', parentId: null, depth: 0, isHidden: false, likes: 5, createdAt: new Date(), user: null, mod: { id: 'm', name: 'Mod', slug: 'm' } },
    { id: 'c2', text: 'reply', parentId: 'c1', depth: 1, isHidden: false, likes: 1, createdAt: new Date(), user: null, mod: { id: 'm', name: 'Mod', slug: 'm' } },
  ])
  ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'p', modId: 'mod-1', depth: 0, userId: 'u2', isHidden: false })
  ;(db.modComment.create as jest.Mock).mockResolvedValue({ id: 'new', depth: 1 })
})

describe('comments sort/thread', () => {
  it('sort=newest passes orderBy createdAt desc', async () => {
    const res = await creatorGET(req('http://x/api/creator/comments?sort=newest'))
    expect(res.status).toBe(200)
    expect(db.modComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'desc' } }))
  })

  it('sort=oldest passes orderBy createdAt asc', async () => {
    const res = await creatorGET(req('http://x/api/creator/comments?sort=oldest'))
    expect(res.status).toBe(200)
    expect(db.modComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'asc' } }))
  })

  it('sort=popular passes orderBy likes desc', async () => {
    const res = await creatorGET(req('http://x/api/creator/comments?sort=popular'))
    expect(res.status).toBe(200)
    expect(db.modComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { likes: 'desc' } }))
  })

  it('default sort is newest', async () => {
    const res = await creatorGET(req('http://x/api/creator/comments'))
    expect(res.status).toBe(200)
    expect(db.modComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'desc' } }))
  })

  it('response includes parentId and depth', async () => {
    const res = await creatorGET(req('http://x/api/creator/comments'))
    const body = await res.json()
    expect(body.data.comments[0]).toHaveProperty('parentId')
    expect(body.data.comments[0]).toHaveProperty('depth')
  })

  it('blocks reply to hidden comment', async () => {
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'p', modId: 'mod-1', depth: 0, userId: 'u2', isHidden: true })
    const res = await modsPOST(req('http://x/', { text: 'r', parentId: 'p' }), { params: Promise.resolve({ slug: 'test-mod' }) } as any)
    expect(res.status).toBe(404)
    expect(db.modComment.create).not.toHaveBeenCalled()
  })

  it('invalid sort returns 422', async () => {
    const res = await creatorGET(req('http://x/api/creator/comments?sort=foo'))
    expect(res.status).toBe(422)
  })
})

describe('static wiring', () => {
  const mgr = fs.readFileSync(path.join(root, 'src/components/creator/comments-manager.tsx'), 'utf8')
  const card = fs.readFileSync(path.join(root, 'src/components/comments/comment-card.tsx'), 'utf8')
  const uc = fs.readFileSync(path.join(root, 'src/components/comments/use-comments.ts'), 'utf8')
  const types = fs.readFileSync(path.join(root, 'src/lib/types.ts'), 'utf8')
  const modComments = fs.readFileSync(path.join(root, 'src/components/mod-comments.tsx'), 'utf8')

  it('clears selected on page/filter change', () => {
    expect(mgr).toMatch(/setSelected\(\[\]\)/)
  })

  it('shows pagination controls even with one page', () => {
    expect(mgr).not.toMatch(/totalPages > 1/)
    expect(modComments).not.toMatch(/totalPages > 1/)
  })

  it('refetches after reply', () => {
    expect(mgr).toMatch(/fetchComments\(\)/)
  })

  it('thread indentation + reply-to excerpt present', () => {
    expect(mgr).toMatch(/marginInlineStart/)
    expect(mgr).toMatch(/رد على:/)
  })

  it('hides reply button at depth >= 5', () => {
    expect(mgr).toMatch(/>= 5/)
    expect(card).toMatch(/>= 5|>= COMMENTS_CONFIG\.maxDepth/)
  })

  it('adds canReply to comment type', () => {
    expect(types).toMatch(/canReply\?: boolean/)
  })

  it('clamps page to valid range', () => {
    expect(uc).toMatch(/page > totalPages/)
    expect(mgr).toMatch(/page > totalPages/)
  })
})
