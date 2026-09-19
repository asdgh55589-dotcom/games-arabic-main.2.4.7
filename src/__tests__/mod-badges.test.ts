/**
 * Mod badge system tests.
 * Engine tests are pure (no mocks). API tests use mocked auth/db.
 */
import {
  calculateBadges,
  decideRecalcBadges,
  DEFAULT_FEATURED_TIERS,
  normalizeTiers,
  parseHiddenBadges,
  resolveBadgeSettings,
  tierForDownloads,
  type ModBadgeState,
} from '@/lib/badges'

const SETTINGS = resolveBadgeSettings(null)
const NOW = new Date('2026-09-19T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000)
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3600 * 1000)

const OLD_MOD: ModBadgeState = {
  createdAt: hoursAgo(100),
  updatedAt: hoursAgo(100),
}

// ============================================================
// Featured tiers
// ============================================================
describe('featured tiers', () => {
  it.each([
    [100, 1, 2],
    [200, 2, 3],
    [300, 3, 4],
    [500, 4, 5],
    [1000, 5, 7],
  ])('%i downloads → level %i for %i days', (downloads, level, days) => {
    const found = tierForDownloads(downloads, DEFAULT_FEATURED_TIERS)
    expect(found?.level).toBe(level)
    expect(found?.tier.durationDays).toBe(days)
  })

  it('returns null below the first tier', () => {
    expect(tierForDownloads(99, DEFAULT_FEATURED_TIERS)).toBeNull()
  })

  it('higher tiers override lower tiers', () => {
    expect(tierForDownloads(600, DEFAULT_FEATURED_TIERS)?.level).toBe(4)
    expect(tierForDownloads(5000, DEFAULT_FEATURED_TIERS)?.level).toBe(5)
  })

  it('normalizeTiers falls back to defaults on garbage', () => {
    expect(normalizeTiers(null)).toEqual(DEFAULT_FEATURED_TIERS)
    expect(normalizeTiers('x')).toEqual(DEFAULT_FEATURED_TIERS)
    expect(normalizeTiers([{ downloads: -5, durationDays: 0 }])).toEqual(
      DEFAULT_FEATURED_TIERS,
    )
  })
})

// ============================================================
// calculateBadges — performance
// ============================================================
describe('calculateBadges performance', () => {
  it('shows nothing with no downloads and no overrides', () => {
    expect(calculateBadges(OLD_MOD, 0, SETTINGS, NOW).performance).toBeNull()
  })

  it('trending at 50+ downloads, popular at 20+', () => {
    expect(calculateBadges(OLD_MOD, 50, SETTINGS, NOW).performance).toBe('trending')
    expect(calculateBadges(OLD_MOD, 49, SETTINGS, NOW).performance).toBe('popular')
    expect(calculateBadges(OLD_MOD, 20, SETTINGS, NOW).performance).toBe('popular')
    expect(calculateBadges(OLD_MOD, 19, SETTINGS, NOW).performance).toBeNull()
  })

  it('featured wins over trending and popular', () => {
    const mod: ModBadgeState = {
      ...OLD_MOD,
      featuredLevel: 1,
      featuredUntil: hoursAhead(5),
    }
    // 600 downloads would qualify trending/popular/featured-tier — featured shown
    expect(calculateBadges(mod, 600, SETTINGS, NOW).performance).toBe('featured')
  })

  it('trending wins over popular', () => {
    expect(calculateBadges(OLD_MOD, 60, SETTINGS, NOW).performance).toBe('trending')
  })

  it('featured persists after downloads drop (until expiry)', () => {
    const mod: ModBadgeState = {
      ...OLD_MOD,
      featuredLevel: 3,
      featuredUntil: hoursAhead(10),
    }
    const r = calculateBadges(mod, 0, SETTINGS, NOW)
    expect(r.performance).toBe('featured')
    expect(r.featuredLevel).toBe(3)
  })

  it('expired featured falls back to trending/popular', () => {
    const mod: ModBadgeState = {
      ...OLD_MOD,
      featuredLevel: 2,
      featuredUntil: hoursAgo(1),
    }
    expect(calculateBadges(mod, 60, SETTINGS, NOW).performance).toBe('trending')
    expect(calculateBadges(mod, 0, SETTINGS, NOW).performance).toBeNull()
  })

  it('admin trending override shows without downloads', () => {
    const mod: ModBadgeState = { ...OLD_MOD, trendingUntil: hoursAhead(3) }
    expect(calculateBadges(mod, 0, SETTINGS, NOW).performance).toBe('trending')
  })

  it('expired override disappears', () => {
    const mod: ModBadgeState = { ...OLD_MOD, trendingUntil: hoursAgo(1) }
    expect(calculateBadges(mod, 0, SETTINGS, NOW).performance).toBeNull()
  })

  it('hidden badges fall through to the next highest', () => {
    const mod: ModBadgeState = {
      ...OLD_MOD,
      featuredLevel: 1,
      featuredUntil: hoursAhead(5),
      hiddenBadges: 'featured',
    }
    expect(calculateBadges(mod, 60, SETTINGS, NOW).performance).toBe('trending')
  })

  it('all performance hidden → null, time still shown', () => {
    const mod: ModBadgeState = {
      createdAt: hoursAgo(1),
      updatedAt: hoursAgo(1),
      featuredLevel: 1,
      featuredUntil: hoursAhead(5),
      hiddenBadges: 'featured,trending,popular',
    }
    const r = calculateBadges(mod, 500, SETTINGS, NOW)
    expect(r.performance).toBeNull()
    expect(r.time).toBe('new')
  })

  it('disabled system hides performance but keeps time', () => {
    const off = resolveBadgeSettings({ badgesEnabled: false })
    const mod: ModBadgeState = {
      createdAt: hoursAgo(1),
      updatedAt: hoursAgo(1),
      featuredLevel: 2,
      featuredUntil: hoursAhead(5),
    }
    const r = calculateBadges(mod, 500, off, NOW)
    expect(r.performance).toBeNull()
    expect(r.time).toBe('new')
  })

  it('custom thresholds are honored', () => {
    const custom = resolveBadgeSettings({ trendingThreshold: 100, popularThreshold: 50 })
    expect(calculateBadges(OLD_MOD, 60, custom, NOW).performance).toBe('popular')
    expect(calculateBadges(OLD_MOD, 120, custom, NOW).performance).toBe('trending')
  })
})

// ============================================================
// calculateBadges — time (system-only, no override possible)
// ============================================================
describe('calculateBadges time', () => {
  it('new within 48 hours', () => {
    expect(
      calculateBadges({ createdAt: hoursAgo(1), updatedAt: hoursAgo(1) }, 0, SETTINGS, NOW)
        .time,
    ).toBe('new')
    expect(
      calculateBadges({ createdAt: hoursAgo(48), updatedAt: hoursAgo(48) }, 0, SETTINGS, NOW)
        .time,
    ).toBe('new')
  })

  it('updated when old but touched within 24 hours', () => {
    expect(
      calculateBadges({ createdAt: hoursAgo(100), updatedAt: hoursAgo(2) }, 0, SETTINGS, NOW)
        .time,
    ).toBe('updated')
  })

  it('nothing when old and untouched', () => {
    expect(calculateBadges(OLD_MOD, 0, SETTINGS, NOW).time).toBeNull()
  })

  it('new takes precedence over updated', () => {
    // created 1h ago — new even though updated 1h ago too
    expect(
      calculateBadges({ createdAt: hoursAgo(1), updatedAt: hoursAgo(1) }, 500, SETTINGS, NOW),
    ).toEqual(expect.objectContaining({ time: 'new' }))
  })

  it('performance + time shown simultaneously', () => {
    const r = calculateBadges(
      { createdAt: hoursAgo(2), updatedAt: hoursAgo(2) },
      60,
      SETTINGS,
      NOW,
    )
    expect(r.performance).toBe('trending')
    expect(r.time).toBe('new')
  })
})

describe('parseHiddenBadges', () => {
  it('parses CSV case-insensitively', () => {
    expect(parseHiddenBadges('Featured, TRENDING')).toEqual(new Set(['featured', 'trending']))
    expect(parseHiddenBadges(null)).toEqual(new Set())
    expect(parseHiddenBadges('')).toEqual(new Set())
  })
})

// ============================================================
// decideRecalcBadges
// ============================================================
describe('decideRecalcBadges', () => {
  const base = { id: 'm1', createdAt: hoursAgo(100), updatedAt: hoursAgo(100) }

  it('grants featured at the qualified tier', () => {
    const next = decideRecalcBadges(base, 250, SETTINGS, NOW)
    expect(next.isFeatured).toBe(true)
    expect(next.featuredLevel).toBe(2)
    expect(next.featuredUntil?.getTime()).toBe(NOW.getTime() + 3 * 24 * 3600 * 1000)
  })

  it('keeps active higher level instead of downgrading', () => {
    const next = decideRecalcBadges(
      { ...base, featuredLevel: 4, featuredUntil: hoursAhead(50) },
      150,
      SETTINGS,
      NOW,
    )
    expect(next.featuredLevel).toBe(4)
    expect(next.featuredUntil?.getTime()).toBe(hoursAhead(50).getTime())
  })

  it('upgrades when downloads qualify higher', () => {
    const next = decideRecalcBadges(
      { ...base, featuredLevel: 1, featuredUntil: hoursAhead(5) },
      600,
      SETTINGS,
      NOW,
    )
    expect(next.featuredLevel).toBe(4)
  })

  it('keeps featured persistent while active even with low downloads', () => {
    const next = decideRecalcBadges(
      { ...base, featuredLevel: 2, featuredUntil: hoursAhead(5) },
      3,
      SETTINGS,
      NOW,
    )
    expect(next.isFeatured).toBe(true)
  })

  it('clears expired featured', () => {
    const next = decideRecalcBadges(
      { ...base, featuredLevel: 2, featuredUntil: hoursAgo(2) },
      3,
      SETTINGS,
      NOW,
    )
    expect(next.isFeatured).toBe(false)
    expect(next.featuredLevel).toBeNull()
  })

  it('trending auto-grant refreshes Until; admin-far override preserved', () => {
    const auto = decideRecalcBadges(base, 80, SETTINGS, NOW)
    expect(auto.isTrending).toBe(true)
    expect(auto.trendingUntil?.getTime()).toBe(NOW.getTime() + 24 * 3600 * 1000)

    const far = hoursAhead(100)
    const kept = decideRecalcBadges({ ...base, trendingUntil: far }, 80, SETTINGS, NOW)
    expect(kept.trendingUntil?.getTime()).toBe(far.getTime())
  })

  it('unqualified + expired override → trending cleared', () => {
    const next = decideRecalcBadges(
      { ...base, trendingUntil: hoursAgo(2) },
      5,
      SETTINGS,
      NOW,
    )
    expect(next.isTrending).toBe(false)
    expect(next.trendingUntil).toBeNull()
  })

  it('unqualified but future override → trending kept (admin override)', () => {
    const next = decideRecalcBadges(
      { ...base, trendingUntil: hoursAhead(10) },
      5,
      SETTINGS,
      NOW,
    )
    expect(next.isTrending).toBe(true)
  })

  it('isLatest follows 48h window; daily counter synced', () => {
    const fresh = decideRecalcBadges(
      { id: 'm2', createdAt: hoursAgo(5), updatedAt: hoursAgo(5) },
      7,
      SETTINGS,
      NOW,
    )
    expect(fresh.isLatest).toBe(true)
    expect(fresh.dailyDownloads).toBe(7)
    const stale = decideRecalcBadges(base, 7, SETTINGS, NOW)
    expect(stale.isLatest).toBe(false)
  })

  it('disabled system drops all performance badges', () => {
    const off = resolveBadgeSettings({ badgesEnabled: false })
    const next = decideRecalcBadges(
      { ...base, featuredLevel: 3, featuredUntil: hoursAhead(9), trendingUntil: hoursAhead(9) },
      900,
      off,
      NOW,
    )
    expect(next.isFeatured).toBe(false)
    expect(next.isTrending).toBe(false)
    expect(next.featuredUntil).toBeNull()
    expect(next.trendingUntil).toBeNull()
  })
})
