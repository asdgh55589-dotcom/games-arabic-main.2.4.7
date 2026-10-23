/**
 * P0-3 regression — archived teams must never leak into the public sitemap.
 */
const mockTeamFindMany = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    mod: { findMany: jest.fn().mockResolvedValue([]) },
    game: { findMany: jest.fn().mockResolvedValue([]) },
    section: { findMany: jest.fn().mockResolvedValue([]) },
    series: { findMany: jest.fn().mockResolvedValue([]) },
    team: { findMany: (...args: unknown[]) => mockTeamFindMany(...args) },
  },
}))

import sitemap from '@/app/sitemap'

describe('sitemap archived teams', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTeamFindMany.mockResolvedValue([
      { slug: 'active-team', updatedAt: new Date('2026-01-01') },
    ])
  })

  it('queries only non-archived teams', async () => {
    await sitemap()

    expect(mockTeamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { archivedAt: null } }),
    )
  })

  it('emits active team URLs and omits archived ones', async () => {
    const urls = (await sitemap()).map((entry) => entry.url)

    expect(urls.some((url) => url.endsWith('/teams/active-team'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/teams/archived-team'))).toBe(false)
  })
})
