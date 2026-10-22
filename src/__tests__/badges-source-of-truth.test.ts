/**
 * R22/S4 — the 24h-download badge source of truth.
 *
 * `Mod.dailyDownloads` used to be BOTH the counter and the badge input, which
 * made the badge depend on a denormalised column that drifts (and could be
 * reset by the admin "reset counter" operation).
 *
 * Contract:
 *   - the SINGLE source for "downloads in the last 24h" is the `DownloadClick`
 *     table (`db.downloadClick.count(...)`),
 *   - the badge decision NEVER gates on `Mod.dailyDownloads`,
 *   - `Mod.dailyDownloads` is only written as a mirror (display value).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { countDownloadsLast24h, refreshBadgesOnDownload } from '@/lib/badges'

const root = process.cwd()

function src(): string {
  return fs.readFileSync(path.join(root, 'src/lib/badges.ts'), 'utf8')
}

const NOW = new Date('2026-10-22T12:00:00.000Z')
const OLD = new Date('2026-10-01T00:00:00.000Z')

interface FakeDb {
  mod: { findUnique: jest.Mock; update: jest.Mock }
  downloadClick: { count: jest.Mock }
  badgeSettings: { findUnique: jest.Mock }
  badgeAuditLog: { create: jest.Mock }
}

function makeDb(overrides: {
  dailyDownloads?: number
  clicks?: number
  thresholds?: { trending: number; popular: number }
}): FakeDb {
  const thresholds = overrides.thresholds ?? { trending: 5, popular: 2 }
  return {
    mod: {
      findUnique: jest.fn().mockResolvedValue({
        createdAt: OLD,
        updatedAt: OLD,
        featuredLevel: null,
        featuredUntil: null,
        trendingUntil: null,
        popularUntil: null,
        hiddenBadges: '',
        // The mirror column is deliberately present and deliberately WRONG —
        // the badge must ignore it.
        dailyDownloads: overrides.dailyDownloads ?? 0,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    downloadClick: {
      count: jest.fn().mockResolvedValue(overrides.clicks ?? 0),
    },
    badgeSettings: {
      findUnique: jest.fn().mockResolvedValue({
        trendingThreshold: thresholds.trending,
        popularThreshold: thresholds.popular,
        featuredTiers: [{ downloads: 100, durationDays: 2 }],
        badgesEnabled: true,
      }),
    },
    badgeAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  }
}

describe('badges — the 24h download source of truth (source)', () => {
  it('the 24h-download count reads the DownloadClick table', () => {
    const s = src()
    expect(s).toMatch(/db\.downloadClick\.count\(/)
    expect(s).toMatch(/export async function countDownloadsLast24h/)
  })

  it('the badge path never selects/gates on Mod.dailyDownloads', () => {
    const s = src()
    expect(s).not.toMatch(/dailyDownloads:\s*true/)
    expect(s).not.toMatch(/isSameUtcDay/)
    expect(s).not.toMatch(/mod\.dailyDownloads/)
  })
})

describe('badges — the 24h download source of truth (behaviour)', () => {
  it('counts the last-24h downloads from DownloadClick only', async () => {
    const db = makeDb({ clicks: 7 })

    const n = await countDownloadsLast24h(db, 'mod-1', NOW)

    expect(n).toBe(7)
    expect(db.downloadClick.count).toHaveBeenCalledWith({
      where: { modId: 'mod-1', createdAt: { gte: expect.any(Date) } },
    })
    const since = db.downloadClick.count.mock.calls[0][0].where.createdAt.gte as Date
    expect(since.getTime()).toBe(NOW.getTime() - 24 * 60 * 60 * 1000)
  })

  it('grants trending/popular from the DownloadClick count even when dailyDownloads is 0', async () => {
    const db = makeDb({ clicks: 7, dailyDownloads: 0, thresholds: { trending: 5, popular: 2 } })

    await refreshBadgesOnDownload(db, 'mod-1', NOW)

    expect(db.mod.update).toHaveBeenCalledTimes(1)
    const data = db.mod.update.mock.calls[0][0].data as Record<string, unknown>
    // trending threshold 5, popular threshold 2 — 7 clicks clears both
    expect(data.isTrending).toBe(true)
    expect(data.trendingUntil).toBeInstanceOf(Date)
    // NOTE: `Mod` has no `isPopular` column (only isFeatured/isTrending/isLatest)
    // so the popular badge is expressed through `popularUntil` only.
    expect(data.popularUntil).toBeInstanceOf(Date)
  })

  it('does NOT grant trending from a stale dailyDownloads mirror', async () => {
    const db = makeDb({ clicks: 0, dailyDownloads: 999, thresholds: { trending: 5, popular: 2 } })

    await refreshBadgesOnDownload(db, 'mod-1', NOW)

    const data = db.mod.update.mock.calls[0][0].data as Record<string, unknown>
    expect(data.isTrending).toBeUndefined()
    expect(data.trendingUntil).toBeUndefined()
    expect(data.popularUntil).toBeUndefined()
  })

  it('writes dailyDownloads as a mirror of the DownloadClick count', async () => {
    const db = makeDb({ clicks: 42, dailyDownloads: 0 })

    await refreshBadgesOnDownload(db, 'mod-1', NOW)

    const data = db.mod.update.mock.calls[0][0].data as Record<string, unknown>
    expect(data.dailyDownloads).toBe(42)
    expect(data.lastDownloadDate).toBe(NOW)
  })

  it('never selects dailyDownloads from the mod row', async () => {
    const db = makeDb({ clicks: 3 })

    await refreshBadgesOnDownload(db, 'mod-1', NOW)

    const select = db.mod.findUnique.mock.calls[0][0].select as Record<string, unknown>
    expect(select).not.toHaveProperty('dailyDownloads')
    expect(select).not.toHaveProperty('lastDownloadDate')
  })
})
