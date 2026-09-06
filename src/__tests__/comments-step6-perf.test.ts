/**
 * STEP 6 — Performance audit as executable measurements (audit only, no fixes).
 * - Runtime: GET tree-build time + JSON payload bytes at 100/1000/2000 rows,
 *   per-endpoint DB round-trip counts (mocked Prisma call counting).
 * - Static: memo/virtualization/lazy/cache/index assertions on real sources.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { POST as reactionPOST } from '@/app/api/comments/[id]/reaction/route'
import { DELETE as commentsDELETE, PATCH as commentsPATCH } from '@/app/api/comments/[id]/route'
import { GET as modsGET, POST as modsPOST } from '@/app/api/mods/[slug]/comments/route'

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    commentLike: { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (ops: any) => ops),
  },
}))
jest.mock('@/lib/auth', () => ({ getOptionalSession: jest.fn() }))
jest.mock('@/lib/rate-limit', () => ({ rateLimit: jest.fn(async () => ({ success: true })) }))
jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: () => ({
    sendCommentReply: { execute: jest.fn().mockResolvedValue(undefined) },
    sendTopLevelComment: { execute: jest.fn().mockResolvedValue(undefined) },
  }),
}))

import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

const root = process.cwd()
const uiFiles = [
  'src/components/mod-comments.tsx',
  'src/components/comments/comment-card.tsx',
  'src/components/comments/comment-toolbar.tsx',
  'src/components/comments/reply-box.tsx',
  'src/components/comments/use-comments.ts',
  'src/components/comments/use-comment-actions.ts',
]
const ui = uiFiles.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')

beforeEach(() => {
  jest.resetAllMocks()
  // resetAllMocks wipes factory impls — restore the permissive default
  ;(rateLimit as jest.Mock).mockResolvedValue({ success: true })
  ;(getOptionalSession as jest.Mock).mockResolvedValue({ id: 'u1', username: 'م', role: 'member' })
  ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', name: 'م', authorId: 'a1' })
})

function flatComments(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    modId: 'mod-1',
    userId: 'u1',
    guestName: 'زائر',
    guestAvatar: null,
    parentId: i % 5 === 0 || i === 0 ? null : `c${i - 1}`,
    text: 'نص تعليق تجريبي للقياس مع بعض الكلمات الإضافية لزيادة الحجم قليلا',
    likes: i % 7,
    dislikes: 0,
    isPinned: i === 0,
    isEdited: false,
    isHidden: false,
    createdAt: new Date(Date.now() - i * 1000),
    updatedAt: new Date(),
    user: {
      id: 'u1',
      username: 'مستخدم',
      avatarUrl: null,
      role: 'member',
      tier: null,
      specialRoles: null,
    },
  }))
}

describe('4.2 GET payload + tree-build scaling (FIXED: server pagination)', () => {
  // Like Prisma: honor roots / rows-by-id / level-scan shapes (unfiltered mocks
  // duplicate replies exponentially and explode the payload).
  function mockTable(all: any[]) {
    ;(db.modComment.findMany as jest.Mock).mockImplementation(async (args: any) => {
      const w: any = args?.where ?? {}
      if (w.id?.in) return all.filter((c) => w.id.in.includes(c.id))
      if (w.parentId && typeof w.parentId === 'object' && 'in' in w.parentId)
        return all.filter((c) => c.parentId && w.parentId.in.includes(c.parentId))
      return all.filter((c) => c.parentId == null)
    })
  }
  it.each([100, 1000, 2000])(
    'N=%i: one page of roots (≤20 trees), total preserved, payload bounded',
    async (n) => {
      mockTable(flatComments(n))
      ;(db.modComment.count as jest.Mock).mockResolvedValue(n)
      const t0 = performance.now()
      const res = await modsGET(
        { url: 'http://x/?sort=newest' } as any,
        {
          params: Promise.resolve({ slug: 'm' }),
        } as any,
      )
      const ms = performance.now() - t0
      const body = await res.json()
      const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8')
      // eslint-disable-next-line no-console
      console.log(
        `GET comments N=${n}: tree+serialize ${ms.toFixed(1)}ms, payload ${(bytes / 1024).toFixed(1)}KB`,
      )
      expect(res.status).toBe(200)
      expect(body.data.comments.length).toBeLessThanOrEqual(20) // page, was N
      expect(body.data.total).toBe(n)
      expect(body.data.totalRoots).toBe(Math.ceil(n / 5))
      if (n > 100) expect(body.data.nextCursor).toBeTruthy() // more pages remain
      else expect(body.data.nextCursor).toBeNull() // exactly one page
      expect(bytes).toBeLessThan(150 * 1024) // was ~1MB at N=2000
    },
  )
})

describe('3.1 DB round trips per endpoint (mocked call counts)', () => {
  function trips() {
    return (
      (db.mod.findUnique as jest.Mock).mock.calls.length +
      (db.modComment.findUnique as jest.Mock).mock.calls.length +
      (db.modComment.findMany as jest.Mock).mock.calls.length +
      (db.modComment.create as jest.Mock).mock.calls.length +
      (db.modComment.update as jest.Mock).mock.calls.length +
      (db.modComment.deleteMany as jest.Mock).mock.calls.length +
      (db.mod.update as jest.Mock).mock.calls.length +
      (db.commentLike.findUnique as jest.Mock).mock.calls.length +
      (db.commentLike.create as jest.Mock).mock.calls.length
    )
  }
  it('POST top-level = 3 trips (mod + create + counter)', async () => {
    ;(db.modComment.create as jest.Mock).mockResolvedValue({ id: 'c1' })
    await modsPOST(
      { url: 'http://x/', json: async () => ({ text: 'hi' }) } as any,
      {
        params: Promise.resolve({ slug: 'm' }),
      } as any,
    )
    expect(trips()).toBe(3)
  })
  it('POST reply = 4 trips (mod + parent[depth] + create + counter), no table scan', async () => {
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'p',
      modId: 'mod-1',
      parentId: null,
      depth: 0,
      userId: 'u2',
    })
    ;(db.modComment.create as jest.Mock).mockResolvedValue({ id: 'c2' })
    await modsPOST(
      { url: 'http://x/', json: async () => ({ text: 'r', parentId: 'p' }) } as any,
      {
        params: Promise.resolve({ slug: 'm' }),
      } as any,
    )
    expect(trips()).toBe(4) // was 6 (full-table depth scan + parent re-read gone)
    expect(db.modComment.findMany as jest.Mock).not.toHaveBeenCalled()
  })
  it('PATCH = 2 trips (read + update)', async () => {
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c', userId: 'u1' })
    ;(db.modComment.update as jest.Mock).mockResolvedValue({ id: 'c' })
    await commentsPATCH(
      { url: 'http://x/', json: async () => ({ text: 'e' }) } as any,
      {
        params: Promise.resolve({ id: 'c' }),
      } as any,
    )
    expect(trips()).toBe(2)
  })
  it('DELETE = 3 calls + full-table BFS scan (read + scan + txn)', async () => {
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'c',
      userId: 'u1',
      modId: 'mod-1',
    })
    ;(db.modComment.findMany as jest.Mock).mockResolvedValue([{ id: 'c', parentId: null }])
    await commentsDELETE(
      { url: 'http://x/' } as any,
      { params: Promise.resolve({ id: 'c' }) } as any,
    )
    expect(db.modComment.findMany as jest.Mock).toHaveBeenCalled() // whole-table child-map scan
    expect(db.$transaction as jest.Mock).toHaveBeenCalledTimes(1)
  })
  it('like = 4 trips (comment + vote + txn + refetch)', async () => {
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c', likes: 1, dislikes: 0 })
    ;(db.commentLike.findUnique as jest.Mock).mockResolvedValue(null)
    await reactionPOST({ url: 'http://x/', json: async () => ({ value: 'like' }) } as any, { params: Promise.resolve({ id: 'c' }) } as any)
    expect((db.modComment.findUnique as jest.Mock).mock.calls.length).toBe(2)
  })
})

describe('3.1.3 composite indexes captured in migrations (static)', () => {
  it('schema (modId,createdAt) is captured in the baseline migration SQL', () => {
    // History squash (20260907000000_baseline): old per-change migration dirs
    // were retired after proving column/index parity — point at the baseline.
    const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
    const mig = fs.readFileSync(
      path.join(root, 'prisma/migrations/20260907000000_baseline/migration.sql'),
      'utf8',
    )
    expect(schema).toMatch(/@@index\(\[modId, createdAt\]\)/)
    expect(mig).toMatch(/"ModComment"\("modId", "createdAt"\)/)
  })
})

describe('5. Rendering: no memo/virtualization/lazy (static)', () => {
  it('CommentCard is a plain function: no memo, recursion re-renders subtree', () => {
    expect(ui).toMatch(/export function CommentCard\(/)
    expect(ui).not.toMatch(/memo\(.*CommentCard|const CommentCard = memo/)
  })
  it('inline arrow handlers reduced 35 → 15 by the split (Phase 5 backlog: useCallback)', () => {
    expect((ui.match(/onClick=\{\(\) =>/g) || []).length).toBeLessThanOrEqual(20)
  })
  it('only MarkdownRenderer is memoized; sortPopular re-sorts + updateLikesInTree deep-clones on every like', () => {
    const renderer = fs.readFileSync(
      path.join(root, 'src/components/markdown-renderer.tsx'),
      'utf8',
    )
    expect(renderer).toMatch(/memo\(function MarkdownRenderer/)
    expect(ui).toMatch(/const updated = updateLikesInTree\(prev, id, delta\)/)
  })
  it('avatars: Radix <img> with no loading=lazy, no next/image', () => {
    expect(ui).not.toMatch(/loading="lazy"|<Image/)
  })
  it('no virtualization library for 1000-comment lists', () => {
    const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    expect(pkg).not.toMatch(/react-window|virtua|tanstack\/.*virtual/)
    expect(ui).not.toMatch(/virtual/i)
  })
})

describe('6. Network: no cache strategy on comment APIs (static)', () => {
  it('comment routes set no Cache-Control; UI fetch uses no next.revalidate/cache option', () => {
    const route = fs.readFileSync(
      path.join(root, 'src/app/api/mods/[slug]/comments/route.ts'),
      'utf8',
    )
    expect(route).not.toMatch(/Cache-Control|revalidate/)
    expect(ui).not.toMatch(/next:\s*\{[^}]*revalidate|cache:\s*['"]force-cache/)
  })
})

describe('2. Bundle: sanitize-html ships to browser for a 12-line pure function (static)', () => {
  it('client MarkdownRenderer imports lib/sanitize whose top level requires sanitize-html', () => {
    const renderer = fs.readFileSync(
      path.join(root, 'src/components/markdown-renderer.tsx'),
      'utf8',
    )
    const lib = fs.readFileSync(path.join(root, 'src/lib/sanitize.ts'), 'utf8')
    expect(renderer).toMatch(/from '@\/lib\/sanitize'/)
    expect(lib).toMatch(/from 'sanitize-html'/)
    expect(renderer).not.toMatch(/sanitizeHTML/) // only sanitizeUrl (pure) is used client-side
  })
  it('react-markdown + isomorphic-dompurify are installed but imported nowhere', () => {
    const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    expect(pkg).toMatch(/react-markdown/)
    expect(pkg).toMatch(/isomorphic-dompurify/)
    const hits: string[] = []
    for (const f of ['src/components/markdown-renderer.tsx', 'src/components/mod-comments.tsx']) {
      const s = fs.readFileSync(path.join(root, f), 'utf8')
      if (/react-markdown|isomorphic-dompurify/.test(s)) hits.push(f)
    }
    expect(hits).toEqual([])
  })
})
