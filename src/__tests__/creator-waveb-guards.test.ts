/**
 * WAVE B Task 8 — cross-page guard matrix (static) + reports pagination.
 * Every studio page gates the same 6 roles; members redirect to apply.
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

const SIX_ROLES = ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

describe('6-role gate on every studio page (static)', () => {
  // NOTE: (studio)/page.tsx (dashboard) is intentionally absent — it is a
  // client component inside the gated layout, which enforces the 6 roles
  // (asserted in the layout test below).
  const pages = [
    'src/app/creator/(studio)/mods/page.tsx',
    'src/app/creator/(studio)/mods/new/page.tsx',
    'src/app/creator/(studio)/mods/[id]/edit/page.tsx',
    'src/app/creator/(studio)/stats/page.tsx',
    'src/app/creator/(studio)/comments/page.tsx',
    'src/app/creator/(studio)/requests/page.tsx',
    'src/app/creator/(studio)/likes/page.tsx',
    'src/app/creator/(studio)/news/page.tsx',
    'src/app/creator/(studio)/reports/page.tsx',
    'src/app/creator/(studio)/settings/page.tsx',
  ]

  it.each(pages)('%s admits all 6 roles and redirects members to apply', (file) => {
    const content = src(file)
    for (const role of SIX_ROLES) {
      expect(content).toContain(`'${role}'`)
    }
    expect(content).toMatch(/become-creator\/apply/)
  })

  it('studio layout enforces the same gate', () => {
    const layout = src('src/app/creator/(studio)/layout.tsx')
    for (const role of SIX_ROLES) {
      expect(layout).toContain(`'${role}'`)
    }
  })
})

describe('reports pagination passthrough', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(requireCreatorStudio as jest.Mock).mockResolvedValue({
      user: { id: 'u1', username: 'c1', email: 'c@x', role: 'creator', avatarUrl: null },
      error: null,
    })
    ;(db.report.count as jest.Mock).mockResolvedValue(45)
    ;(db.report.findMany as jest.Mock).mockResolvedValue([])
  })

  it('page 2 skips 20, caps limit at 50', async () => {
    const res = await reportsGET({ url: 'http://x/api/creator/reports?page=2&limit=20' } as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(db.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    )
    expect(body.data.pagination).toMatchObject({ page: 2, total: 45, totalPages: 3 })
  })

  it('limit clamps to [1,50]', async () => {
    await reportsGET({ url: 'http://x/api/creator/reports?limit=500' } as any)
    expect((db.report.findMany as jest.Mock).mock.calls[0][0].take).toBe(50)
  })
})
