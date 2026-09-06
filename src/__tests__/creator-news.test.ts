/**
 * WAVE A Task 3 — creator news: direct publish (no review), own-only
 * mutations, drafts invisible publicly, published rows surface in the
 * public /api/news feed. UI wiring asserted statically.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { GET as publicGET } from '@/app/api/news/route'
import { GET as listGET, POST as createPOST } from '@/app/api/creator/news/route'
import { DELETE as deleteOne, PATCH as patchOne } from '@/app/api/creator/news/[id]/route'

jest.mock('@/lib/db', () => ({
  db: {
    news: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const CREATOR = { id: 'u1', username: 'c1', email: 'c@x', role: 'creator', avatarUrl: null }
const OTHER = { id: 'u9', username: 'c9', email: 'c9@x', role: 'creator', avatarUrl: null }
const req = (url: string, body?: unknown, method = 'GET') => ({
  url,
  method,
  json: async () => body ?? {},
}) as any
const idParams = { params: Promise.resolve({ id: 'n1' }) } as any

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  ;(db.news.findMany as jest.Mock).mockResolvedValue([])
  ;(db.news.findFirst as jest.Mock).mockResolvedValue(null)
  ;(db.news.findUnique as jest.Mock).mockResolvedValue(null)
  ;(db.news.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'n1', ...data }))
  ;(db.news.update as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'n1', ...data }))
  ;(db.news.delete as jest.Mock).mockResolvedValue({ id: 'n1' })
})

describe('guards + validation', () => {
  it('rejects unauthenticated create', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: null, error: null })
    const res = await createPOST(req('http://x/', { title: 'Hello world news' }, 'POST'))
    expect(res.status).toBe(422)
  })

  it('rejects short titles and bad enums', async () => {
    expect((await createPOST(req('http://x/', { title: 'ab' }, 'POST'))).status).toBe(422)
    expect((await createPOST(req('http://x/', { title: 'Valid title here', type: 'video' }, 'POST'))).status).toBe(422)
    expect((await createPOST(req('http://x/', { title: 'Valid title here', imageUrl: 'ftp://x' }, 'POST'))).status).toBe(422)
  })

  it('creates drafts invisible by default, stamped with authorId', async () => {
    const res = await createPOST(req('http://x/', { title: 'My mod update news' }, 'POST'))
    expect(res.status).toBe(201)
    expect(db.news.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: 'u1', visible: false }) }),
    )
  })
})

describe('own-only mutations (IDOR)', () => {
  it("cannot PATCH another creator's post → 404, no write", async () => {
    ;(db.news.findFirst as jest.Mock).mockResolvedValue(null) // not own → invisible
    const res = await patchOne(req('http://x/', { title: 'Hijacked title here' }, 'PATCH'), idParams)
    expect(res.status).toBe(404)
    expect(db.news.update).not.toHaveBeenCalled()
  })

  it("cannot DELETE another creator's post → 404", async () => {
    const res = await deleteOne(req('http://x/', undefined, 'DELETE'), idParams)
    expect(res.status).toBe(404)
    expect(db.news.delete).not.toHaveBeenCalled()
  })

  it("cannot touch legacy staff rows (authorId null) via creator API", async () => {
    // findFirst scoped to authorId=user.id can never return staff rows —
    // assert the scoping, the only enforcement point.
    await patchOne(req('http://x/', { title: 'Staff post edit attempt here' }, 'PATCH'), idParams)
    expect(db.news.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'u1' }) }),
    )
  })

  it('publishes own draft (visible toggle)', async () => {
    ;(db.news.findFirst as jest.Mock).mockResolvedValue({ id: 'n1', authorId: 'u1' })
    const res = await patchOne(req('http://x/', { visible: true }, 'PATCH'), idParams)
    expect(res.status).toBe(200)
    expect(db.news.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ visible: true }) }),
    )
  })

  it('lists own rows only', async () => {
    await listGET(req('http://x/api/creator/news'))
    expect(db.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'u1' }) }),
    )
  })

  it('OTHER creator isolated (sanity: different author scope)', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: OTHER, error: null })
    await listGET(req('http://x/api/creator/news'))
    expect(db.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'u9' }) }),
    )
  })
})

describe('public feed includes creator-authored published rows', () => {
  it('drafts excluded, published creator rows included', async () => {
    const published = {
      id: 'n1', title: 'Creator news', visible: true, authorId: 'u1',
      publishAt: new Date(Date.now() - 1000), expiresAt: null, type: 'ticker',
    }
    ;(db.news.findMany as jest.Mock).mockImplementation(async ({ where }: any) => {
      // getActiveNews gate: visible + publishAt<=now + not expired
      expect(where.visible).toBe(true)
      return [published]
    })
    const res = await publicGET(req('http://x/api/news?type=ticker'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.news).toHaveLength(1)
    expect(body.data.news[0].authorId).toBe('u1')
  })
})

describe('UI wiring (static)', () => {
  const root = process.cwd()
  const ui = fs.readFileSync(path.join(root, 'src/components/creator/news-client.tsx'), 'utf8')
  const ar = fs.readFileSync(path.join(root, 'src/lib/studio-i18n/ar.ts'), 'utf8')

  it('list + editor + publish toggle + delete + draft badge, FreeImage image', () => {
    expect(ui).toMatch(/\/api\/creator\/news/)
    expect(ui).toMatch(/t\.saveDraft/)
    expect(ui).toMatch(/t\.publishNow/)
    expect(ui).toMatch(/t\.draft/)
    expect(ui).toMatch(/\/api\/storage\/upload-image/)
  })

  it('Arabic copy exists', () => {
    for (const s of ['الأخبار', 'خبر جديد', 'مسودة', 'منشور', 'إلغاء النشر']) {
      expect(ar).toContain(s)
    }
  })
})
