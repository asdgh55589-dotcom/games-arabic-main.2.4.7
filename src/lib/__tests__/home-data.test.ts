import { HOME_TEAMS_STALE_MS, normalizeHomeData } from '@/lib/home-data'

describe('normalizeHomeData', () => {
  it('returns null for nullish input', () => {
    expect(normalizeHomeData(null)).toBeNull()
    expect(normalizeHomeData(undefined)).toBeNull()
  })

  it('coerces malformed collections to safe defaults', () => {
    const malformed = {
      latestMods: null,
      trendingMods: { not: 'an-array' },
      topEndorsed: undefined,
      topSeries: 'oops',
      modsByPlatform: null,
      featuredGames: 42,
      stats: null,
    }
    const out = normalizeHomeData(malformed as any)
    expect(out).not.toBeNull()
    expect(out?.latestMods).toEqual([])
    expect(out?.trendingMods).toEqual([])
    expect(out?.topEndorsed).toEqual([])
    expect(out?.topSeries).toEqual([])
    expect(out?.modsByPlatform).toEqual({})
    expect(out?.featuredGames).toEqual([])
    expect(out?.stats).toBeNull()
  })

  it('coerces non-array platform entries to empty arrays', () => {
    const input = {
      latestMods: [],
      trendingMods: [],
      topEndorsed: [],
      topSeries: [],
      modsByPlatform: { PC: [{ id: '1' }], PS5: 'broken' },
      featuredGames: [],
      stats: { games: 1 },
    }
    const out = normalizeHomeData(input as any)
    expect(out?.modsByPlatform['PC']).toHaveLength(1)
    expect(out?.modsByPlatform['PS5']).toEqual([])
  })

  it('passes through a well-formed payload untouched', () => {
    const mod = { id: 'm1' }
    const input = {
      latestMods: [mod],
      trendingMods: [],
      topEndorsed: [],
      topSeries: [],
      modsByPlatform: { PC: [mod] },
      featuredGames: [],
      stats: { games: 7 },
    }
    const out = normalizeHomeData(input as any)
    expect(out?.latestMods).toHaveLength(1)
    expect(out?.modsByPlatform['PC']).toHaveLength(1)
    expect(out?.stats).toEqual({ games: 7 })
  })

  it('exposes a 5-minute sub-resource stale TTL', () => {
    expect(HOME_TEAMS_STALE_MS).toBe(5 * 60 * 1000)
  })
})
