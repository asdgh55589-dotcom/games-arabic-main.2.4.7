/**
 * WAVE A Task 4 — creator reports follow-up: outcome-only scoping,
 * field allowlist (leakage test), history actor stripping, filters.
 * UI wiring asserted statically.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { GET as reportsGET } from '@/app/api/creator/reports/route'

jest.mock('@/lib/db', () => ({
  db: {
    report: { count: jest.fn(), findMany: jest.fn() },
  },
}))
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const CREATOR = { id: 'u1', username: 'c1', email: 'c@x', role: 'creator', avatarUrl: null }
const req = (url: string) => ({ url }) as any

const FULL_ROW = {
  id: 'r1',
  createdAt: new Date('2026-09-01'),
  targetType: 'comment',
  reason: 'spam',
  status: 'resolved',
  actionTaken: 'content_hidden',
  actionAt: new Date('2026-09-02'),
  resolution: 'تم إخفاء التعليق المخالف',
  resolvedAt: new Date('2026-09-02'),
  // SENSITIVE — must never reach the response:
  reporterId: 'snitch-1',
  reporter: { id: 'snitch-1', username: 'snitch', email: 's@evil.test' },
  description: 'reporter private text',
  evidenceUrls: ['https://evil.test/e1.png'],
  ipAddress: '1.2.3.4',
  fraudScore: 0.9,
  repeatOffenseLevel: 2,
  assignedToId: 'mod-1',
  assignedTo: { username: 'mod' },
  fraudSignals: [{ signal: 'x' }],
  targetMod: { id: 'm1', name: 'Mod One', slug: 'mod-one' },
  targetComment: { id: 'c1', text: 'x'.repeat(200), createdAt: new Date('2026-08-30') },
  statusHistory: [
    { toStatus: 'resolved', action: 'content_hidden', resolution: 'تم الإخفاء', createdAt: new Date('2026-09-02'), actorId: 'mod-1', actor: { username: 'mod' } },
  ],
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  ;(db.report.count as jest.Mock).mockResolvedValue(1)
  ;(db.report.findMany as jest.Mock).mockResolvedValue([FULL_ROW])
})

describe('scoping', () => {
  it('queries ONLY reports on own mods (direct + via comments)', async () => {
    await reportsGET(req('http://x/api/creator/reports'))
    expect(db.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ targetMod: { authorId: 'u1' } }),
            expect.objectContaining({ targetComment: { mod: { authorId: 'u1' } } }),
          ]),
        }),
      }),
    )
  })

  it('rejects unauthenticated + bad status filter', async () => {
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: null, error: null })
    expect((await reportsGET(req('http://x/api/creator/reports'))).status).toBe(422)
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
    expect((await reportsGET(req('http://x/api/creator/reports?status=bogus'))).status).toBe(422)
  })

  it('empty state shape', async () => {
    ;(db.report.count as jest.Mock).mockResolvedValue(0)
    ;(db.report.findMany as jest.Mock).mockResolvedValue([])
    const body = await (await reportsGET(req('http://x/api/creator/reports'))).json()
    expect(body.data.reports).toEqual([])
    expect(body.data.pagination.total).toBe(0)
  })
})

describe('leakage (outcome-only allowlist)', () => {
  it('FORBIDDEN fields are absent from the payload', async () => {
    const body = await (await reportsGET(req('http://x/api/creator/reports'))).json()
    const text = JSON.stringify(body)
    for (const secret of [
      'snitch-1', 's@evil.test', 'reporter private text', 'evil.test/e1.png',
      '1.2.3.4', 'fraudSignals', 'repeatOffenseLevel', 'assignedTo',
    ]) {
      expect(text).not.toContain(secret)
    }
    expect(text).not.toMatch(/"reporterId"|"evidenceUrls"|"ipAddress"|"fraudScore"|"actorId"|"actor":/)
  })

  it('ALLOWED fields present: outcome, excerpt ≤50, anonymized history', async () => {
    const body = await (await reportsGET(req('http://x/api/creator/reports'))).json()
    const r = body.data.reports[0]
    expect(r.id).toBe('r1')
    expect(r.reason).toBe('spam')
    expect(r.status).toBe('resolved')
    expect(r.actionTaken).toBe('content_hidden')
    expect(r.resolution).toBe('تم إخفاء التعليق المخالف')
    expect(r.mod).toMatchObject({ name: 'Mod One', slug: 'mod-one' })
    expect(r.commentExcerpt).toHaveLength(50)
    expect(r.latest).toMatchObject({ toStatus: 'resolved', action: 'content_hidden' })
    expect(r.latest).not.toHaveProperty('actorId')
    expect(r.latest).not.toHaveProperty('actor')
  })

  it('select allowlist never requests sensitive columns', async () => {
    await reportsGET(req('http://x/api/creator/reports'))
    const select = (db.report.findMany as jest.Mock).mock.calls[0][0].select
    expect(select).not.toHaveProperty('reporterId')
    expect(select).not.toHaveProperty('reporter')
    expect(select).not.toHaveProperty('evidenceUrls')
    expect(select).not.toHaveProperty('ipAddress')
    expect(select).not.toHaveProperty('fraudScore')
    expect(select).not.toHaveProperty('fraudSignals')
    expect(select).not.toHaveProperty('assignedToId')
    expect(select).not.toHaveProperty('assignedTo')
    expect(select).not.toHaveProperty('description')
  })
})

describe('UI wiring (static)', () => {
  const root = process.cwd()
  const ui = fs.readFileSync(path.join(root, 'src/components/creator/reports-client.tsx'), 'utf8')
  const ar = fs.readFileSync(path.join(root, 'src/lib/studio-i18n/ar.ts'), 'utf8')

  it('timeline + filters + outcome text, no reporter rendering', () => {
    expect(ui).toMatch(/\/api\/creator\/reports\?/)
    expect(ui).toMatch(/t\.outcome/)
    expect(ui).toMatch(/commentExcerpt/)
    expect(ui).not.toMatch(/reporter|evidence|fraud|assignedTo/i)
  })

  it('Arabic copy exists', () => {
    for (const s of ['متابعة البلاغات', 'قرار الإدارة', 'لم يصدر قرار بعد', 'سبام وإعلانات', 'قيد المراجعة']) {
      expect(ar).toContain(s)
    }
  })
})
