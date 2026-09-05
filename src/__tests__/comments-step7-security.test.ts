/**
 * STEP 7 — Security audit as executable assertions (AUDIT ONLY, read-only).
 * Triggers attack strings through real handlers (mocked db/auth) + asserts
 * config/source facts. Documents CURRENT behavior; fixes wait for STEP 8.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { GET as adminGET } from '@/app/api/admin/comments/route'
import { PATCH as creatorPATCH } from '@/app/api/creator/comments/[id]/route'
import { GET as modsGET, POST as modsPOST } from '@/app/api/mods/[slug]/comments/route'
import { sanitizeUrl } from '@/lib/sanitize'

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findUnique: jest.fn(), update: jest.fn() },
    modComment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}))
jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn(),
  requireModerator: jest.fn(),
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/application/use-cases/factory', () => ({
  getUseCases: () => ({
    sendCommentReply: { execute: jest.fn().mockResolvedValue(undefined) },
    sendTopLevelComment: { execute: jest.fn().mockResolvedValue(undefined) },
  }),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true, remaining: 4, resetAt: 0, limit: 5 })),
}))

import { getOptionalSession, requireCreatorStudio, requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// sanitize-html ships ESM unparsable by ts-jest; mocked so @/lib/sanitize can
// load. sanitizeUrl under test is pure and never touches the mocked module.
jest.mock('sanitize-html', () => ({ __esModule: true, default: jest.fn((h: string) => h) }))

const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const slugParams = { params: Promise.resolve({ slug: 'm' }) } as any
const req = (url: string, body?: unknown) => ({ url, json: async () => body ?? {} }) as any

beforeEach(() => {
  jest.resetAllMocks()
  // resetAllMocks wipes factory impls — restore permissive defaults
  ;(rateLimit as jest.Mock).mockResolvedValue({ success: true, remaining: 4, resetAt: 0, limit: 5 })
  ;(getOptionalSession as jest.Mock).mockResolvedValue({ id: 'u1', username: 'م', role: 'member' })
  ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', name: 'م', authorId: 'a1' })
})

describe('7.1 entity-bypass XSS: stored verbatim, render layer has no decoder', () => {
  it.each([`&lt;script&gt;alert(1)&lt;/script&gt;`, `<img src=x onerror=alert(1)>`])(
    'POST %j → 200 stored as inert data (React escapes on render)',
    async (evil) => {
      ;(db.modComment.create as jest.Mock).mockResolvedValue({ id: 'cx', text: evil })
      const res = await modsPOST(req('http://x/', { text: evil }), slugParams)
      expect(res.status).toBe(200)
      expect(db.modComment.create as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ text: evil }) }),
      )
    },
  )
  it('markdown-renderer performs no entity decoding (no unescape/decode/he)', () => {
    const r = src('src/components/markdown-renderer.tsx')
    expect(r).not.toMatch(/decode|unescape|\bhe\b|entities\.decode/)
    expect(r).not.toMatch(/dangerouslySetInnerHTML/)
  })
})

describe('7.1 markdown image javascript: — syntax unsupported + URL blocked anyway', () => {
  it('renderer has no image-syntax branch (renders as literal text)', () => {
    const r = src('src/components/markdown-renderer.tsx')
    expect(r).not.toMatch(/!\[|image/)
  })
  it('sanitizeUrl blocks the payload URL regardless', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
  })
})

describe('7.1 nested JSON bomb → 422, never reaches Prisma', () => {
  it.each([
    [{ text: { nested: { deep: ['x'] } } }],
    [{ text: ['a', 'b'] }],
    [{ text: 'hi', parentId: { id: 'p' } }],
    [{ text: 'hi', parentId: ['p1', 'p2'] }],
  ])('POST %j → 422', async (body) => {
    const res = await modsPOST(req('http://x/', body), slugParams)
    expect(res.status).toBe(422)
    expect(db.modComment.create as jest.Mock).not.toHaveBeenCalled()
  })
})

describe("7.2 IDOR: creator cannot moderate another creator's mod", () => {
  it('PATCH hide on foreign mod → 403', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: { id: 'creator-B', role: 'creator' },
      error: null,
    })
    ;(db.modComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1',
      mod: { authorId: 'creator-A' },
    })
    const res = await creatorPATCH(
      { url: 'http://x/', json: async () => ({ action: 'hide' }) } as any,
      {
        params: Promise.resolve({ id: 'c1' }),
      } as any,
    )
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error?.code).toBe('FORBIDDEN')
    expect(db.modComment.update as jest.Mock).not.toHaveBeenCalled()
  })
})

describe('7.2 admin auth failure returns REAL status (FIXED: was masked as 500)', () => {
  it('requireModerator 401 → 401 UNAUTHORIZED in Arabic', async () => {
    // plain {status} object: also proves the duck-typing fallback (mocked auth has no AuthError class)
    ;(requireModerator as jest.Mock).mockRejectedValue({ status: 401 })
    const res = await adminGET(req('http://x/api/admin/comments'))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
  it('requireModerator 403 → 403 FORBIDDEN in Arabic', async () => {
    ;(requireModerator as jest.Mock).mockRejectedValue({ status: 403 })
    const res = await adminGET(req('http://x/api/admin/comments'))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error?.code).toBe('FORBIDDEN')
  })
})

describe('7.3 no sensitive user fields in comment reads (select allowlists)', () => {
  it('public GET selects only safe user fields', async () => {
    ;(db.modComment.findMany as jest.Mock).mockResolvedValue([])
    await modsGET(req('http://x/'), slugParams)
    const args = (db.modComment.findMany as jest.Mock).mock.calls[0][0]
    const keys = Object.keys(args.include.user.select)
    expect(keys).toEqual(expect.arrayContaining(['id', 'username', 'avatarUrl', 'role']))
    expect(keys).not.toEqual(expect.arrayContaining(['email', 'phone']))
    expect(JSON.stringify(args)).not.toMatch(/email|phone|password/i)
  })
  it('admin GET selects only id/username/avatarUrl', async () => {
    ;(requireModerator as jest.Mock).mockResolvedValue({ id: 'm', role: 'moderator' })
    ;(db.modComment.findMany as jest.Mock).mockResolvedValue([])
    ;(db.modComment.count as jest.Mock).mockResolvedValue(0)
    await adminGET(req('http://x/api/admin/comments'))
    const args = (db.modComment.findMany as jest.Mock).mock.calls[0][0]
    expect(JSON.stringify(args)).not.toMatch(/email|phone|password/i)
  })
})

describe('7.3 error responses carry no stack/DB internals', () => {
  it('DB throw → 500 envelope without stack or query text', async () => {
    ;(db.modComment.create as jest.Mock).mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.1:5432; SELECT * FROM "ModComment"'),
    )
    const res = await modsPOST(req('http://x/', { text: 'hi' }), slugParams)
    const raw = JSON.stringify(await res.json())
    expect(res.status).toBe(500)
    expect(raw).not.toMatch(/ECONNREFUSED|10\.0\.0\.1|SELECT|at |stack/i)
  })
})

describe('7.5 security headers configured (static, proxy.ts)', () => {
  const proxy = src('src/proxy.ts')
  it.each([
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
  ])('%s present', (h) => expect(proxy).toContain(h))
  it('clickjacking denied + MIME sniffing off', () => {
    expect(proxy).toMatch(/X-Frame-Options', 'DENY'/)
    expect(proxy).toMatch(/X-Content-Type-Options', 'nosniff'/)
  })
  it('CSP notes unsafe-eval/inline debt explicitly (documented, not silent)', () => {
    expect(proxy).toMatch(/unsafe-eval/)
    expect(proxy).toMatch(/nonce migration/)
  })
})

describe('7.2/7.4 output-encoding + gate inventory (static)', () => {
  it('no DOMPurify in renderer; defense = React escaping + sanitizeUrl + sanitize-html elsewhere', () => {
    const r = src('src/components/markdown-renderer.tsx')
    expect(r).not.toMatch(/DOMPurify|dompurify/)
    expect(r).toMatch(/sanitizeUrl/)
  })
  it('every comment write endpoint gates on session/role', () => {
    expect(src('src/app/api/mods/[slug]/comments/route.ts')).toMatch(/getOptionalSession/)
    expect(
      src('src/app/api/comments/[id]/route.ts').match(/getOptionalSession/g)!.length,
    ).toBeGreaterThanOrEqual(2)
    expect(src('src/app/api/comments/[id]/like/route.ts')).toMatch(/getOptionalSession/)
    expect(src('src/app/api/comments/[id]/dislike/route.ts')).toMatch(/getOptionalSession/)
    expect(src('src/app/api/admin/comments/route.ts')).toMatch(/requireModerator/)
    expect(src('src/app/api/creator/comments/[id]/route.ts')).toMatch(/requireCreatorStudio/)
  })
})
