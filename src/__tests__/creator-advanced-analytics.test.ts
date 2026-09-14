/**
 * WAVE B Task 6 — advanced analytics on DESIGN SHELLS ONLY: chart series
 * toggle, KPI cards (conversion/click-rate/period-likes/news-views),
 * top-mods server aggregate. No invented chart types (static) + route tests.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { GET as topModsGET } from '@/app/api/creator/analytics/top-mods/route'

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findMany: jest.fn() },
    modView: { groupBy: jest.fn() },
    downloadClick: { groupBy: jest.fn() },
  },
}))
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn(async () => null),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const CREATOR = { id: 'u1', username: 'c1', email: 'c@x', role: 'creator', avatarUrl: null }
const req = (url: string) => ({ url }) as any

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  ;(db.mod.findMany as jest.Mock).mockImplementation(async ({ where }: any) => {
    if (where?.authorId) return [{ id: 'm1' }, { id: 'm2' }]
    return [
      { id: 'm1', name: 'Mod One', workflowStatus: 'PUBLISHED', game: { name: 'Game' } },
      { id: 'm2', name: 'Mod Two', workflowStatus: 'DRAFT', game: null },
    ]
  })
  ;(db.downloadClick.groupBy as jest.Mock).mockResolvedValue([
    { modId: 'm1', _count: { _all: 40 } },
    { modId: 'm2', _count: { _all: 5 } },
  ])
  ;(db.modView.groupBy as jest.Mock).mockResolvedValue([
    { modId: 'm1', _count: { _all: 400 } },
    { modId: 'm2', _count: { _all: 50 } },
  ])
})

describe('GET /api/creator/analytics/top-mods', () => {
  it('ranks by period downloads with views joined + mod meta', async () => {
    const res = await topModsGET(req('http://x/api/creator/analytics/top-mods?range=30&limit=10'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.mods[0]).toMatchObject({ modId: 'm1', downloads: 40, views: 400 })
    expect(body.data.mods[1]).toMatchObject({ modId: 'm2', downloads: 5, views: 50 })
  })

  it('rejects bad range; scopes groups to own mods', async () => {
    expect((await topModsGET(req('http://x/api/creator/analytics/top-mods?range=5'))).status).toBe(422)
    await topModsGET(req('http://x/api/creator/analytics/top-mods'))
    const where = (db.downloadClick.groupBy as jest.Mock).mock.calls[0][0].where
    expect(where.modId.in).toEqual(['m1', 'm2'])
  })

  it('rejects unauthenticated (403, mirrors analytics route)', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: null, error: null })
    expect((await topModsGET(req('http://x/api/creator/analytics/top-mods'))).status).toBe(403)
  })
})

describe('design shells only (static)', () => {
  const root = process.cwd()
  const chart = fs.readFileSync(
    path.join(root, 'src/components/creator-dashboard/chart-area-interactive.tsx'),
    'utf8',
  )
  const cards = fs.readFileSync(
    path.join(root, 'src/components/creator-dashboard/section-cards.tsx'),
    'utf8',
  )
  const page = fs.readFileSync(
    path.join(root, 'src/app/creator/(studio)/page.tsx'),
    'utf8',
  )
  const ar = fs.readFileSync(path.join(root, 'src/lib/studio-i18n/ar.ts'), 'utf8')

  it('chart: same Area shell, series-2 toggles downloads ↔ comment-clicks', () => {
    expect(chart).toMatch(/seriesMode/)
    expect(chart).toMatch(/commentClicks/)
    expect(chart).toMatch(/dict\.chart\.commentClicks/)
    // No new chart types introduced:
    expect(chart).not.toMatch(/BarChart|PieChart|LineChart|RadialBar/)
    expect(chart).toMatch(/<AreaChart/)
  })

  it('cards: same card shell gains conversion/click-rate/likes/news-views KPIs', () => {
    expect(cards).toMatch(/dict\.cards\.conversion/)
    expect(cards).toMatch(/dict\.cards\.clickRate/)
    expect(cards).toMatch(/dict\.cards\.periodLikes/)
    expect(cards).toMatch(/dict\.cards\.newsViews/)
    expect(cards).toMatch(/viewToDownloadPct/)
  })

  it('dashboard table fed by period top-mods aggregate', () => {
    expect(page).toMatch(/\/api\/creator\/analytics\/top-mods/)
  })

  it('Arabic copy exists', () => {
    for (const s of ['نقرات التعليقات', 'التحويل مشاهدة', 'معدل فتح التعليقات', 'تأييدات الفترة', 'مشاهدات الأخبار']) {
      expect(ar).toContain(s)
    }
  })
})
