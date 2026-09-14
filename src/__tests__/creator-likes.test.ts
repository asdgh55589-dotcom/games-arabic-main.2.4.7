/**
 * WAVE A Task 2 — creator likes: guards, grouping, privacy (usernames only),
 * period validation, empty states. UI wiring asserted statically.
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

describe('guards + validation', () => {
  it('rejects unauthenticated', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: null, error: null })
    const res = await likesGET(req('http://x/api/creator/likes'))
    expect(res.status).toBe(422)
  })

  it('rejects bad range', async () => {
    const res = await likesGET(req('http://x/api/creator/likes?range=5'))
    expect(res.status).toBe(422)
  })

  it('empty state shape when no engagement', async () => {
    const res = await likesGET(req('http://x/api/creator/likes?range=7'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.summary.endorsements).toBe(0)
    expect(body.data.mods).toEqual([])
    expect(body.data.recent).toEqual([])
  })
})

describe('grouping + privacy', () => {
  beforeEach(() => {
    ;(db.endorsement.count as jest.Mock)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(9)
    ;(db.endorsement.groupBy as jest.Mock).mockResolvedValue([
      { modId: 'm1', _count: { _all: 5 } },
    ])
    ;(db.endorsement.findMany as jest.Mock).mockResolvedValue([
      {
        createdAt: new Date('2026-09-01'),
        user: { username: 'fan1', email: 'fan1@evil.test' },
        mod: { name: 'Mod One', slug: 'mod-one' },
      },
    ])
  })

  it('groups per mod with deltas', async () => {
    const res = await likesGET(req('http://x/api/creator/likes?range=30'))
    const body = await res.json()
    expect(body.data.summary.endorsements).toBe(5)
    expect(body.data.summary.endorsementsDelta).toBe(150) // (5-2)/2
    expect(body.data.mods[0]).toMatchObject({ modId: 'm1', endorsements: 5 })
    expect(body.data.summary.topMod.modId).toBe('m1')
  })

  it('exposes display names ONLY — no emails anywhere in payload', async () => {
    const res = await likesGET(req('http://x/api/creator/likes'))
    const text = JSON.stringify(await res.json())
    expect(text).toContain('fan1')
    expect(text).not.toContain('fan1@evil.test')
    expect(text).not.toMatch(/"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}"/i)
  })

  it('queries are creator-scoped (authorId), never global', async () => {
    await likesGET(req('http://x/api/creator/likes'))
    const scopeCalls = [
      ...(db.endorsement.count as jest.Mock).mock.calls,
      ...(db.commentLike.count as jest.Mock).mock.calls,
      ...(db.modRating.count as jest.Mock).mock.calls,
    ]
    expect(scopeCalls.length).toBeGreaterThan(0)
    for (const [where] of scopeCalls) {
      expect(JSON.stringify(where)).toMatch(/"authorId":"u1"/)
    }
  })
})

describe('UI wiring (static)', () => {
  const root = process.cwd()
  const ui = fs.readFileSync(path.join(root, 'src/components/creator/likes-client.tsx'), 'utf8')
  const ar = fs.readFileSync(path.join(root, 'src/lib/studio-i18n/ar.ts'), 'utf8')
  const nav = fs.readFileSync(
    path.join(root, 'src/components/creator-dashboard/app-sidebar.tsx'),
    'utf8',
  )

  it('KPI cards + table + range filter + sidebar entry, no emails rendered', () => {
    expect(ui).toMatch(/\/api\/creator\/likes\?range=/)
    expect(ui).toMatch(/t\.endorsements/)
    expect(ui).toMatch(/t\.commentLikes/)
    expect(ui).toMatch(/t\.avgRating/)
    expect(ui).not.toMatch(/\.email/)
    expect(nav).toMatch(/\/creator\/likes/)
  })

  it('Arabic copy exists', () => {
    for (const s of ['الإعجابات', 'التأييدات', 'إعجابات التعليقات', 'متوسط التقييم', 'الأعلى تفاعلاً']) {
      expect(ar).toContain(s)
    }
  })
})
