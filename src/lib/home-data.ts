import type { GameSummary, HomeData, ModSummary, SeriesSummary, SiteStats } from './types'

/**
 * lib/home-data.ts — homepage payload safety + sub-resource cache TTLs.
 *
 * LEDA-14 (Phase 1 blocking fixes from the LEDA-13 audit):
 * - `/api/home` occasionally returns null / partial / malformed payloads.
 *   `normalizeHomeData` coerces them to safe defaults so the homepage never
 *   crashes on `.slice` / `.map` / `.length` of a non-array.
 */

/** Client-side stale-while-revalidate TTL for homepage sub-resources (5 min). */
export const HOME_TEAMS_STALE_MS = 5 * 60 * 1000

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRecord<T>(value: unknown): Record<string, T[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, T[]> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = asArray<T>(entry)
  }
  return out
}

export interface NormalizedHomeData {
  latestMods: ModSummary[]
  trendingMods: ModSummary[]
  topEndorsed: ModSummary[]
  topSeries: SeriesSummary[]
  modsByPlatform: Record<string, ModSummary[]>
  featuredGames: GameSummary[]
  stats: SiteStats | null
}

/**
 * Coerce a nullable / partially-malformed `/api/home` payload to safe
 * defaults. Returns `null` when there is no payload at all (so callers can
 * still distinguish "no data" from "empty data").
 */
export function normalizeHomeData(input: HomeData | null | undefined): NormalizedHomeData | null {
  if (!input || typeof input !== 'object') return null
  return {
    latestMods: asArray<ModSummary>(input.latestMods),
    trendingMods: asArray<ModSummary>(input.trendingMods),
    topEndorsed: asArray<ModSummary>(input.topEndorsed),
    topSeries: asArray<SeriesSummary>(input.topSeries),
    modsByPlatform: asRecord<ModSummary>(input.modsByPlatform),
    featuredGames: asArray<GameSummary>(input.featuredGames),
    stats: input.stats && typeof input.stats === 'object' ? input.stats : null,
  }
}
