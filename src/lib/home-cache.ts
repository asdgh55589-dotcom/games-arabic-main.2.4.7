// Shared in-memory cache for homepage data — allows admin routes to invalidate it
let homeDataCache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL_MS = 60 * 1000 // 60s — reduced from 300s for real-time stats (Issue 4)

export function getHomeCache(): { data: unknown; timestamp: number } | null {
  return homeDataCache
}

export function setHomeCache(data: unknown, timestamp: number): void {
  homeDataCache = { data, timestamp }
}

export function clearHomeCache(): void {
  homeDataCache = null
}

export function getHomeCacheTtl(): number {
  return CACHE_TTL_MS
}
